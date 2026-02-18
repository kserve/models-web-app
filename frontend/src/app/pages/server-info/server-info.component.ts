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
  public serverName: string;
  public namespace: string;
  public serverInfoLoaded = false;
  public inferenceService: InferenceServiceK8s;
  public ownedObjects: InferenceServiceOwnedObjects = {};
  public grafanaFound = true;
  public isEditing = false;
  public editingIsvc: InferenceServiceK8s;
  public sseEnabled = false;

  public buttonsConfig: ToolbarButton[] = [
    new ToolbarButton({
      text: 'EDIT',
      icon: 'edit',
      fn: () => {
        console.log('[Debug] EDIT button clicked. Setting isEditing = true.'); // Add log
        // Make a copy of current isvc so polling update doesn't affect editing
        this.editingIsvc = JSON.parse(JSON.stringify(this.inferenceService)); // Use deep copy
        this.isEditing = true;
        console.log('[Debug] isEditing is now:', this.isEditing); // Add log
        console.log('[Debug] editingIsvc data:', this.editingIsvc); // Add log
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
    // Check SSE configuration
    this.configService.getConfig().subscribe(config => {
      this.sseEnabled = config.sseEnabled !== false;
    });

    this.route.params.subscribe(params => {
      console.log($localize`Using namespace: ${params.namespace}`);
      this.ns.updateSelectedNamespace(params.namespace);

      this.serverName = params.name;
      this.namespace = params.namespace;

      if (this.sseEnabled) {
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
                // Resource was deleted, navigate back to list
                console.log('InferenceService deleted, navigating to index');
                this.router.navigate(['/']);
              } else if (event.type === 'ERROR') {
                console.error('SSE error event received:', event.message);
                this.startPolling();
              }
            },
            error => {
              console.error(
                'SSE connection error, falling back to polling:',
                error,
              );
              this.startPolling();
            },
          );
      } else {
        this.startPolling();
      }
    });

    // don't show a METRICS tab if Grafana is not exposed
    console.log($localize`Checking if Grafana endpoint is exposed`);
    this.configService.getConfig().subscribe(
      config => {
        this.checkGrafanaAvailability(config.grafanaPrefix);
      },
      error => {
        console.error(
          'Failed to load configuration for ServerInfoComponent:',
          error,
        );
        // Use default prefix as fallback
        this.checkGrafanaAvailability('/grafana');
      },
    );
  }

  ngOnDestroy() {
    this.pollingSubscription?.unsubscribe();
    this.sseSubscription?.unsubscribe();
  }

  private startPolling() {
    this.pollingSubscription = this.poller.start().subscribe(() => {
      this.getBackendObjects();
    });
  }

  private loadOwnedObjects(inferenceService: InferenceServiceK8s) {
    const components = ['predictor', 'transformer', 'explainer'];
    const obs: Observable<[string, string, ComponentOwnedObjects]>[] = [];

    components.forEach(component => {
      obs.push(this.getOwnedObjects(inferenceService, component));
    });

    forkJoin(...obs).subscribe(objects => {
      const ownedObjects = {};
      for (const obj of objects) {
        const component = obj[0];
        ownedObjects[component] = obj[1];
      }

      this.ownedObjects = ownedObjects;
      this.serverInfoLoaded = true;
    });
  }

  get status(): Status {
    return getK8sObjectUiStatus(this.inferenceService);
  }

  public cancelEdit() {
    console.log('[Debug] cancelEdit called. Setting isEditing = false.'); // Add log
    this.isEditing = false;
  }

  public navigateBack() {
    this.router.navigate(['/']);
  }

  public deleteInferenceService() {
    const inferenceService = this.inferenceService;
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
    console.log(
      $localize`Fetching info for InferenceService ${this.namespace}/${this.serverName}`,
    );

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
  ): Observable<any> {
    if (
      !inferenceService.status ||
      !inferenceService.status.components[component]
    ) {
      return of([component, {}]);
    }

    // Check deployment mode
    const deploymentMode = this.getDeploymentMode(inferenceService);

    if (deploymentMode === 'ModelMesh') {
      // Handle ModelMesh mode
      return this.backend
        .getModelMeshObjects(
          this.namespace,
          inferenceService.metadata.name,
          component,
        )
        .pipe(
          map(objects => [component, objects]),
          catchError(error => {
            console.error(
              `Error fetching ModelMesh objects for ${component}:`,
              error,
            );
            return of([component, {}]);
          }),
        );
    } else if (deploymentMode === 'Standard') {
      // Handle Standard mode
      return this.backend
        .getStandardDeploymentObjects(
          this.namespace,
          inferenceService.metadata.name,
          component,
        )
        .pipe(
          map(objects => [component, objects]),
          catchError(error => {
            console.error(
              `Error fetching Standard objects for ${component}:`,
              error,
            );
            return of([component, {}]);
          }),
        );
    } else {
      // Handle Serverless mode
      const revName =
        inferenceService.status.components[component].latestCreatedRevision;
      const objects: ComponentOwnedObjects = {
        revision: undefined,
        configuration: undefined,
        knativeService: undefined,
        route: undefined,
      };

      return this.backend.getKnativeRevision(this.namespace, revName).pipe(
        tap(r => (objects.revision = r)),

        // GET the configuration
        map(r => {
          return r.metadata.ownerReferences[0].name;
        }),
        concatMap(confName => {
          return this.backend.getKnativeConfiguration(this.namespace, confName);
        }),
        tap(c => (objects.configuration = c)),

        // GET the Knative service
        map(c => {
          return c.metadata.ownerReferences[0].name;
        }),
        concatMap(svcName => {
          return this.backend.getKnativeService(this.namespace, svcName);
        }),
        tap(
          knativeInferenceService =>
            (objects.knativeService = knativeInferenceService),
        ),

        // GET the Knative route
        map(knativeInferenceService => {
          return knativeInferenceService.metadata.name;
        }),
        concatMap(routeName => {
          return this.backend.getKnativeRoute(this.namespace, routeName);
        }),
        tap(route => (objects.route = route)),

        // return the final list of objects
        map(_ => [component, objects]),
      );
    }
  }

  private checkGrafanaAvailability(grafanaPrefix: string): void {
    const grafanaApi = grafanaPrefix + '/api/search';

    this.http
      .get(grafanaApi)
      .pipe(timeout(1000))
      .subscribe({
        next: resp => {
          if (!Array.isArray(resp)) {
            console.log(
              $localize`Response from the Grafana endpoint was not as expected.`,
            );
            this.grafanaFound = false;
            return;
          }

          console.log(
            $localize`Grafana endpoint detected. Will expose a metrics tab.`,
          );
          this.grafanaFound = true;
        },
        error: () => {
          console.log($localize`Could not detect a Grafana endpoint.`);
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
