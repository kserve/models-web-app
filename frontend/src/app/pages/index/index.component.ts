import { Component, OnInit, OnDestroy } from '@angular/core';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';
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

  currentNamespace: string | string[];
  config = defaultConfig;
  inferenceServices: InferenceServiceIR[] = [];

  dashboardDisconnectedState = DashboardState.Disconnected;

  private newEndpointButton = new ToolbarButton({
    text: $localize`New Endpoint`,
    icon: 'add',
    stroked: true,
    fn: () => {
      this.router.navigate(['/new']);
    },
  });

  private viewGraphsButton = new ToolbarButton({
    text: $localize`View Graphs`,
    icon: 'account_tree',
    stroked: true,
    fn: () => {
      this.router.navigate(['/inference-graphs']);
    },
  });

  buttons: ToolbarButton[] = [this.viewGraphsButton, this.newEndpointButton];

  constructor(
    private backend: MWABackendService,
    private confirmDialog: ConfirmDialogService,
    private snack: SnackBarService,
    private router: Router,
    private clipboard: Clipboard,
    public ns: NamespaceService,
    public mwaNamespace: MWANamespaceService,
    public poller: PollerService,
  ) {}

  ngOnInit(): void {
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

    // Initialize after setting up the subscription
    this.mwaNamespace.initialize().subscribe();
  }

  ngOnDestroy() {
    this.namespaceSubscription.unsubscribe();
    this.pollingSubscription.unsubscribe();
  }

  public poll(ns: string | string[]) {
    this.pollingSubscription.unsubscribe();
    this.inferenceServices = [];

    const request = this.backend.getInferenceServices(ns);

    this.pollingSubscription = this.poller
      .exponential(request as any)
      .subscribe((svcs: any) => {
        this.inferenceServices = this.processIncomingData(svcs);
      }) as any;
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
