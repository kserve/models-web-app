import { Component, OnInit, OnDestroy } from '@angular/core';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';
import { ConfigService } from 'src/app/services/config.service';
import { SSEService } from 'src/app/services/sse.service';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  InferenceServiceK8s,
  InferenceServiceIR,
} from 'src/app/types/kfserving/v1beta1';
import { environment } from 'src/environments/environment';
import {
  NamespaceService,
  STATUS_TYPE,
  ActionEvent,
  ConfirmDialogService,
  DIALOG_RESP,
  SnackBarService,
  SnackType,
  DashboardState,
  ToolbarButton,
  SnackBarConfig,
  PollerService,
} from 'kubeflow';
import { Subscription } from 'rxjs';
import { defaultConfig, generateDeleteConfig } from './config';
import { Router } from '@angular/router';
import {
  getPredictorType,
  getK8sObjectUiStatus,
  getPredictorExtensionSpec,
} from 'src/app/shared/utils';

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
})
export class IndexComponent implements OnInit, OnDestroy {
  env = environment;

  namespaceSubscription = new Subscription();
  pollingSubscription = new Subscription();
  sseSubscription = new Subscription();

  currentNamespace: string | string[];
  config = defaultConfig;
  inferenceServices: InferenceServiceIR[] = [];
  sseEnabled = false;

  dashboardDisconnectedState = DashboardState.Disconnected;

  private newEndpointButton = new ToolbarButton({
    text: $localize`New Endpoint`,
    icon: 'add',
    stroked: true,
    fn: () => {
      this.router.navigate(['/new']);
    },
  });

  buttons: ToolbarButton[] = [this.newEndpointButton];

  constructor(
    private backend: MWABackendService,
    private confirmDialog: ConfirmDialogService,
    private snack: SnackBarService,
    private router: Router,
    private clipboard: Clipboard,
    private configService: ConfigService,
    private sseService: SSEService,
    public ns: NamespaceService,
    public mwaNamespace: MWANamespaceService,
    public poller: PollerService,
  ) {}

  ngOnInit(): void {
    this.mwaNamespace.initialize().subscribe();

    // Check SSE configuration
    this.configService.getConfig().subscribe(config => {
      this.sseEnabled = config.sseEnabled !== false;
    });

    // Reset the poller whenever the selected namespace changes
    this.namespaceSubscription = this.mwaNamespace
      .getSelectedNamespace()
      .subscribe(ns => {
        if (!ns) {
          return;
        }

        this.currentNamespace = ns;
        this.poll(ns);
        this.newEndpointButton.namespaceChanged(ns, $localize`Endpoint`);
      });
  }

  ngOnDestroy() {
    this.namespaceSubscription?.unsubscribe();
    this.pollingSubscription?.unsubscribe();
    this.sseSubscription?.unsubscribe();
  }

  public poll(ns: string | string[]) {
    this.pollingSubscription?.unsubscribe();
    this.sseSubscription?.unsubscribe();
    this.inferenceServices = [];

    if (this.sseEnabled && typeof ns === 'string') {
      // Use SSE for real-time updates
      this.sseSubscription = this.sseService
        .watchInferenceServices<InferenceServiceK8s>(ns)
        .subscribe(
          event => {
            if (event.type === 'INITIAL' && event.items) {
              this.inferenceServices = this.processIncomingData(event.items);
            } else if (event.type === 'ADDED' && event.object) {
              const processed = this.processIncomingData([event.object]);
              this.inferenceServices = [
                ...this.inferenceServices,
                ...processed,
              ];
            } else if (
              event.type === 'MODIFIED' &&
              event.object &&
              event.object.metadata
            ) {
              const processed = this.processIncomingData([event.object]);
              if (processed.length > 0) {
                const index = this.inferenceServices.findIndex(
                  svc =>
                    svc.metadata?.name === event.object?.metadata?.name &&
                    svc.metadata?.namespace ===
                      event.object?.metadata?.namespace,
                );
                if (index !== -1) {
                  this.inferenceServices[index] = processed[0];
                  this.inferenceServices = [...this.inferenceServices];
                }
              }
            } else if (
              event.type === 'DELETED' &&
              event.object &&
              event.object.metadata
            ) {
              this.inferenceServices = this.inferenceServices.filter(
                svc =>
                  !(
                    svc.metadata?.name === event.object?.metadata?.name &&
                    svc.metadata?.namespace ===
                      event.object?.metadata?.namespace
                  ),
              );
            } else if (event.type === 'ERROR') {
              console.error('SSE error event received:', event.message);
              this.fallbackToPolling(ns);
            }
          },
          error => {
            console.error(
              'SSE connection error, falling back to polling:',
              error,
            );
            this.fallbackToPolling(ns);
          },
        );
    } else {
      // Use polling
      this.fallbackToPolling(ns);
    }
  }

  private fallbackToPolling(ns: string | string[]) {
    const request = this.backend.getInferenceServices(ns);

    this.pollingSubscription = this.poller
      .exponential(request)
      .subscribe(svcs => {
        this.inferenceServices = this.processIncomingData(svcs);
      });
  }

  // action handling functions
  public reactToAction(a: ActionEvent) {
    const inferenceService = a.data as InferenceServiceIR;

    switch (a.action) {
      case 'delete':
        this.deleteClicked(inferenceService);
        break;
      case 'copy-link':
        this.clipboard.copy(inferenceService.status.url);
        const snackConfiguration: SnackBarConfig = {
          data: {
            msg: `Copied: ${inferenceService.status.url}`,
            snackType: SnackType.Info,
          },
        };
        this.snack.open(snackConfiguration);
        break;
      case 'name:link':
        /*
         * don't allow the user to navigate to the details page of a server
         * that is being deleted
         */
        if (inferenceService.ui.status.phase === STATUS_TYPE.TERMINATING) {
          a.event.stopPropagation();
          a.event.preventDefault();
          const snackConfiguration: SnackBarConfig = {
            data: {
              msg: $localize`Endpoint is being deleted, cannot show details.`,
              snackType: SnackType.Info,
            },
          };
          this.snack.open(snackConfiguration);
          return;
        }
        break;
    }
  }

  private deleteClicked(inferenceService: InferenceServiceIR) {
    const dialogConfiguration = generateDeleteConfig(inferenceService);

    const dialogRef = this.confirmDialog.open('Endpoint', dialogConfiguration);
    const applyingSub = dialogRef.componentInstance.applying$.subscribe(
      applying => {
        if (!applying) {
          return;
        }

        this.backend.deleteInferenceService(inferenceService).subscribe(
          dialogResponse => {
            dialogRef.close(DIALOG_RESP.ACCEPT);
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

      inferenceService.ui.status.phase = STATUS_TYPE.TERMINATING;
      inferenceService.ui.status.message = $localize`Preparing to delete Endpoint...`;
    });
  }

  // functions for converting the response InferenceServices to the
  // Internal Representation objects
  private processIncomingData(svcs: InferenceServiceK8s[]) {
    const svcsCopy: InferenceServiceIR[] = JSON.parse(JSON.stringify(svcs));

    for (const inferenceService of svcsCopy) {
      this.parseInferenceService(inferenceService);
    }

    return svcsCopy;
  }

  private parseInferenceService(inferenceService: InferenceServiceIR) {
    inferenceService.ui = { actions: {} };
    inferenceService.ui.status = getK8sObjectUiStatus(inferenceService);
    inferenceService.ui.actions.copy =
      this.getCopyActionStatus(inferenceService);
    inferenceService.ui.actions.delete =
      this.getDeletionActionStatus(inferenceService);

    const predictorType = getPredictorType(inferenceService.spec.predictor);
    const predictor = getPredictorExtensionSpec(
      inferenceService.spec.predictor,
    );
    inferenceService.ui.predictorType = predictorType;
    inferenceService.ui.runtimeVersion = predictor.runtimeVersion;
    inferenceService.ui.storageUri = predictor.storageUri;
    inferenceService.ui.protocolVersion = predictor.protocolVersion || 'v1';
    inferenceService.ui.link = {
      text: inferenceService.metadata.name,
      url: `/details/${inferenceService.metadata.namespace}/${inferenceService.metadata.name}`,
    };
  }

  private getCopyActionStatus(inferenceService: InferenceServiceIR) {
    if (inferenceService.ui.status.phase !== STATUS_TYPE.READY) {
      return STATUS_TYPE.UNAVAILABLE;
    }

    return STATUS_TYPE.READY;
  }

  private getDeletionActionStatus(inferenceService: InferenceServiceIR) {
    if (inferenceService.ui.status.phase !== STATUS_TYPE.TERMINATING) {
      return STATUS_TYPE.READY;
    }

    return STATUS_TYPE.TERMINATING;
  }

  // util functions
  public inferenceServiceTrackByFn(
    index: number,
    inferenceService: InferenceServiceK8s,
  ) {
    return `${inferenceService.metadata.name}/${inferenceService.metadata.creationTimestamp}`;
  }
}
