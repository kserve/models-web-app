import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, of, forkJoin, Subscription } from 'rxjs';
import { tap, map, concatMap, timeout } from 'rxjs/operators';
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
import { isEqual } from 'lodash';
import { generateDeleteConfig } from '../index/config';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
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
  private pollingSub = new Subscription();

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private ns: NamespaceService,
    private backend: MWABackendService,
    private confirmDialog: ConfirmDialogService,
    private snack: SnackBarService,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      console.log($localize`Using namespace: ${params.namespace}`);
      this.ns.updateSelectedNamespace(params.namespace);

      this.serverName = params.name;
      this.namespace = params.namespace;

      this.pollingSub = this.poller.start().subscribe(() => {
        this.getBackendObjects();
      });
    });

    // don't show a METRICS tab if Grafana is not exposed
    console.log($localize`Checking if Grafana endpoint is exposed`);
    const grafanaApi = environment.grafanaPrefix + '/api/search';

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

  ngOnDestroy() {
    this.pollingSub.unsubscribe();
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
    const svc = this.inferenceService;
    const config = generateDeleteConfig(svc);

    const dialogRef = this.confirmDialog.open($localize`Endpoint`, config);
    const applyingSub = dialogRef.componentInstance.applying$.subscribe(
      applying => {
        if (!applying) {
          return;
        }

        this.backend.deleteInferenceService(svc).subscribe(
          res => {
            dialogRef.close(DIALOG_RESP.ACCEPT);
            this.pollingSub.unsubscribe();

            // const name = `${svc.metadata.namespace}/${svc.metadata.name}`;
            const config: SnackBarConfig = {
              data: {
                msg: $localize`$Delete request was sent.`,
                snackType: SnackType.Info,
              },
            };
            this.snack.open(config);

            this.router.navigate(['']);
          },
          err => {
            config.error = err;
            dialogRef.componentInstance.applying$.next(false);
          },
        );
      },
    );

    dialogRef.afterClosed().subscribe(res => {
      applyingSub.unsubscribe();

      if (res !== DIALOG_RESP.ACCEPT) {
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
      .subscribe(svc => {
        this.updateInferenceService(svc);

        const components = ['predictor', 'transformer', 'explainer'];
        const obs: Observable<[string, string, ComponentOwnedObjects]>[] = [];

        components.forEach(component => {
          obs.push(this.getOwnedObjects(svc, component));
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
      });
  }

  /**
   * The component will update only specific sections of its saved object
   * based on the data it got. It won't create a new object for every backend
   * request.
   */
  private updateInferenceService(svc: InferenceServiceK8s) {
    if (!this.inferenceService) {
      this.inferenceService = svc;
      return;
    }

    if (!isEqual(this.inferenceService.metadata, svc.metadata)) {
      this.inferenceService.metadata = svc.metadata;
    }

    if (!isEqual(this.inferenceService.spec, svc.spec)) {
      this.inferenceService.spec = svc.spec;
    }

    if (!isEqual(this.inferenceService.status, svc.status)) {
      this.inferenceService.status = svc.status;
    }
  }

  private getOwnedObjects(
    svc: InferenceServiceK8s,
    component: string,
  ): Observable<any> {
    if (!svc.status || !svc.status.components[component]) {
      return of([component, {}]);
    }

    const revName = svc.status.components[component].latestCreatedRevision;
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
      tap(knativeSvc => (objects.knativeService = knativeSvc)),

      // GET the Knative route
      map(knativeSvc => {
        return knativeSvc.metadata.name;
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
