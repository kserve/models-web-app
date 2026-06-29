import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, of, forkJoin, Subscription } from 'rxjs';
import { tap, map, concatMap, timeout, catchError } from 'rxjs/operators';
import { Router, ActivatedRoute } from '@angular/router';
import {
  NamespaceService,
  ExponentialBackoff,
  ToolbarButton,
  Condition,
  ConfirmDialogService,
  DIALOG_RESP,
  SnackBarService,
  SnackType,
  SnackBarConfig,
  Status,
  STATUS_TYPE,
} from 'kubeflow';
import { MWABackendService } from 'src/app/services/backend.service';
import { ConfigService } from 'src/app/services/config.service';
import { SSEService } from 'src/app/services/sse.service';
import { isEqual } from 'lodash';
import { generateDeleteConfig } from '../index/config';
import { HttpClient } from '@angular/common/http';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import {
  InferenceServiceOwnedObjects,
  ComponentOwnedObjects,
} from 'src/app/types/backend';
import { getK8sObjectUiStatus } from 'src/app/shared/utils';

@Component({
  selector: 'app-server-info',
  templateUrl: './server-info.component.html',
  styleUrls: ['./server-info.component.scss'],
})
export class ServerInfoComponent implements OnInit, OnDestroy {
  public serverName: string = '';
  public namespace: string = '';
  public serverInfoLoaded = false;
  public inferenceService: InferenceServiceK8s | null = null;
  public ownedObjects: InferenceServiceOwnedObjects = {};
  public grafanaFound = true;
  public isEditing = false;
  public editingIsvc: InferenceServiceK8s | null = null;
  public buttonsConfig: ToolbarButton[] = [
    new ToolbarButton({
      text: 'EDIT',
      icon: 'edit',
      fn: () => {
        if (!this.inferenceService) {
          return;
        }
        this.editingIsvc = JSON.parse(JSON.stringify(this.inferenceService));
        this.isEditing = true;
      },
    }),
    new ToolbarButton({
      text: $localize`DELETE`,
      icon: 'delete',
      fn: () => {
        this.deleteInferenceService();
      },
    }),
  ];

  private poller = new ExponentialBackoff({
    interval: 4000,
    maxInterval: 4001,
    retries: 1,
  });
  private pollingSubscription = new Subscription();
  private sseSubscription = new Subscription();
  private ownedObjectsSubscription = new Subscription();
  private routeSubscription = new Subscription();

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private ns: NamespaceService,
    private backend: MWABackendService,
    private confirmDialog: ConfirmDialogService,
    private snack: SnackBarService,
    private configService: ConfigService,
    private sseService: SSEService,
  ) {}

  ngOnInit() {
    // Handle route params
    this.routeSubscription = this.route.params.subscribe(params => {
      this.sseSubscription?.unsubscribe();
      this.pollingSubscription?.unsubscribe();
      this.ownedObjectsSubscription?.unsubscribe();
      this.serverInfoLoaded = false;
      this.inferenceService = null;
      this.ownedObjects = {};
      this.isEditing = false;
      this.editingIsvc = null;

      this.ns.updateSelectedNamespace(params.namespace);

      this.serverName = params.name;
      this.namespace = params.namespace;

      // Use SSE for real-time updates
      this.sseSubscription = this.sseService
        .watchInferenceService<InferenceServiceK8s>(
          this.namespace,
          this.serverName,
        )
        .subscribe(
          event => {
            if (event.type === 'INITIAL' && event.object) {
              this.updateInferenceService(event.object);
              this.loadOwnedObjects(event.object);
            } else if (
              (event.type === 'MODIFIED' || event.type === 'ADDED') &&
              event.object
            ) {
              this.updateInferenceService(event.object);
              this.loadOwnedObjects(event.object);
            } else if (event.type === 'DELETED') {
              this.router.navigate(['/']);
            } else if (event.type === 'ERROR') {
              this.startPolling();
            }
          },
          error => {
            this.startPolling();
          },
        );
    });

    this.configService.getConfig().subscribe(
      config => {
        this.checkGrafanaAvailability(config.grafanaPrefix);
      },
      () => {
        this.checkGrafanaAvailability('/grafana');
      },
    );
  }

  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
    this.pollingSubscription?.unsubscribe();
    this.sseSubscription?.unsubscribe();
    this.ownedObjectsSubscription?.unsubscribe();
  }

  private startPolling() {
    this.sseSubscription?.unsubscribe();
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = this.poller.start().subscribe(() => {
      this.getBackendObjects();
    });
  }

  private loadOwnedObjects(inferenceService: InferenceServiceK8s) {
    this.ownedObjectsSubscription?.unsubscribe();
    const components = ['predictor', 'transformer', 'explainer'];
    const obs: Observable<[string, ComponentOwnedObjects]>[] = [];

    components.forEach(component => {
      obs.push(this.getOwnedObjects(inferenceService, component));
    });

    this.ownedObjectsSubscription = forkJoin(...obs).subscribe(objects => {
      const ownedObjects: InferenceServiceOwnedObjects = {};
      for (const [component, componentObjects] of objects) {
        (ownedObjects as Record<string, ComponentOwnedObjects>)[component] =
          componentObjects;
      }

      this.ownedObjects = ownedObjects;
      this.serverInfoLoaded = true;
    });
  }

  get status(): Status {
    if (!this.inferenceService) {
      return {
        phase: STATUS_TYPE.UNINITIALIZED,
        state: '',
        message: '',
      };
    }

    return getK8sObjectUiStatus(this.inferenceService);
  }

  public cancelEdit() {
    this.isEditing = false;
  }

  public navigateBack() {
    this.router.navigate(['/']);
  }

  public deleteInferenceService() {
    const inferenceService = this.inferenceService;
    if (!inferenceService) {
      return;
    }
    const dialogConfiguration = generateDeleteConfig(inferenceService);

    const dialogRef = this.confirmDialog.open(
      $localize`Endpoint`,
      dialogConfiguration,
    );
    const applyingSub = dialogRef.componentInstance.applying$.subscribe(
      applying => {
        if (!applying) {
          return;
        }

        this.backend.deleteInferenceService(inferenceService).subscribe(
          dialogResponse => {
            dialogRef.close(DIALOG_RESP.ACCEPT);
            this.pollingSubscription.unsubscribe();

            // const name = `${inferenceService.metadata.namespace}/${inferenceService.metadata.name}`;
            const snackConfiguration: SnackBarConfig = {
              data: {
                msg: $localize`$Delete request was sent.`,
                snackType: SnackType.Info,
              },
            };
            this.snack.open(snackConfiguration);

            this.router.navigate(['']);
          },
          err => {
            dialogConfiguration.error = err;
            dialogRef.componentInstance.applying$.next(false);
          },
        );
      },
    );

    dialogRef.afterClosed().subscribe(dialogResponse => {
      applyingSub.unsubscribe();

      if (dialogResponse !== DIALOG_RESP.ACCEPT) {
        return;
      }
    });
  }

  private getBackendObjects() {
    this.backend
      .getInferenceService(this.namespace, this.serverName)
      .subscribe(inferenceService => {
        this.updateInferenceService(inferenceService);
        this.loadOwnedObjects(inferenceService);
      });
  }

  /**
   * The component will update only specific sections of its saved object
   * based on the data it got. It won't create a new object for every backend
   * request.
   */
  private updateInferenceService(inferenceService: InferenceServiceK8s) {
    if (!this.inferenceService) {
      this.inferenceService = inferenceService;
      return;
    }

    if (!isEqual(this.inferenceService.metadata, inferenceService.metadata)) {
      this.inferenceService.metadata = inferenceService.metadata;
    }

    if (!isEqual(this.inferenceService.spec, inferenceService.spec)) {
      this.inferenceService.spec = inferenceService.spec;
    }

    if (!isEqual(this.inferenceService.status, inferenceService.status)) {
      this.inferenceService.status = inferenceService.status;
    }
  }

  private getOwnedObjects(
    inferenceService: InferenceServiceK8s,
    component: string,
  ): Observable<[string, ComponentOwnedObjects]> {
    if (
      !inferenceService.status ||
      !(inferenceService.status.components as Record<string, any>)?.[component]
    ) {
      return of([component, {} as ComponentOwnedObjects]);
    }

    // Check deployment mode
    const deploymentMode = this.getDeploymentMode(inferenceService);

    if (deploymentMode === 'ModelMesh') {
      // Handle ModelMesh mode
      return this.backend
        .getModelMeshObjects(
          this.namespace,
          inferenceService.metadata?.name || '',
          component,
        )
        .pipe(
          map(
            objects =>
              [component, objects as ComponentOwnedObjects] as [
                string,
                ComponentOwnedObjects,
              ],
          ),
          catchError(() =>
            of([component, {} as ComponentOwnedObjects] as [
              string,
              ComponentOwnedObjects,
            ]),
          ),
        );
    } else if (deploymentMode === 'Standard') {
      // Handle Standard mode
      return this.backend
        .getStandardDeploymentObjects(
          this.namespace,
          inferenceService.metadata?.name || '',
          component,
        )
        .pipe(
          map(
            objects =>
              [component, objects as ComponentOwnedObjects] as [
                string,
                ComponentOwnedObjects,
              ],
          ),
          catchError(() =>
            of([component, {} as ComponentOwnedObjects] as [
              string,
              ComponentOwnedObjects,
            ]),
          ),
        );
    } else {
      // Handle Serverless mode
      const revName =
        (inferenceService.status?.components as Record<string, any>)?.[
          component
        ]?.latestCreatedRevision || '';
      const objects: ComponentOwnedObjects = {
        revision: null,
        configuration: null,
        knativeService: null,
        route: null,
      } as unknown as ComponentOwnedObjects;

      return this.backend.getKnativeRevision(this.namespace, revName).pipe(
        tap(r => (objects.revision = r)),

        // GET the configuration
        map(r => {
          return r.metadata?.ownerReferences?.[0]?.name || '';
        }),
        concatMap(confName => {
          return this.backend.getKnativeConfiguration(this.namespace, confName);
        }),
        tap(c => (objects.configuration = c)),

        // GET the Knative service
        map(c => {
          return c.metadata?.ownerReferences?.[0]?.name || '';
        }),
        concatMap(svcName => {
          return this.backend.getKnativeService(this.namespace, svcName);
        }),
        tap(knativeInferenceService => {
          objects.knativeService = knativeInferenceService;
        }),

        // GET the Knative route
        map(knativeInferenceService => {
          return knativeInferenceService.metadata?.name || '';
        }),
        concatMap(routeName => {
          return this.backend.getKnativeRoute(this.namespace, routeName || '');
        }),
        tap(route => (objects.route = route)),

        // return the final list of objects
        map(_ => [component, objects] as [string, ComponentOwnedObjects]),
      ) as Observable<[string, ComponentOwnedObjects]>;
    }
  }

  private checkGrafanaAvailability(grafanaPrefix: string): void {
    const grafanaApi = grafanaPrefix + '/api/search';

    this.http
      .get(grafanaApi)
      .pipe(timeout(1000))
      .subscribe({
        next: resp => {
          this.grafanaFound = Array.isArray(resp);
        },
        error: () => {
          this.grafanaFound = false;
        },
      });
  }

  private isStandardDeployment(inferenceService: InferenceServiceK8s): boolean {
    const annotations = inferenceService.metadata?.annotations || {};

    // Check for the KServe annotation
    const deploymentMode =
      annotations['serving.kserve.io/deploymentMode'] || '';
    // allowing rawdeployment for backward compatibility
    if (
      deploymentMode.toLowerCase() === 'rawdeployment' ||
      deploymentMode.toLowerCase() === 'standard'
    ) {
      return true;
    }

    // Check for legacy annotation
    const rawMode = annotations['serving.kubeflow.org/raw'] || 'false';
    if (rawMode.toLowerCase() === 'true') {
      return true;
    }

    return false;
  }

  private isModelMeshDeployment(
    inferenceService: InferenceServiceK8s,
  ): boolean {
    const annotations = inferenceService.metadata?.annotations || {};
    const deploymentMode =
      annotations['serving.kserve.io/deploymentMode'] || '';
    return deploymentMode.toLowerCase() === 'modelmesh';
  }

  private getDeploymentMode(inferenceService: InferenceServiceK8s): string {
    if (this.isModelMeshDeployment(inferenceService)) {
      return 'ModelMesh';
    } else if (this.isStandardDeployment(inferenceService)) {
      return 'Standard';
    } else {
      return 'Serverless';
    }
  }
}
