import { Component, OnInit, OnDestroy } from '@angular/core';
import { MWABackendService } from 'src/app/services/backend.service';
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

  buttons: ToolbarButton[] = [this.newEndpointButton];

  constructor(
    private backend: MWABackendService,
    private confirmDialog: ConfirmDialogService,
    private snack: SnackBarService,
    private router: Router,
    private clipboard: Clipboard,
    public ns: NamespaceService,
    public poller: PollerService,
  ) {}

  ngOnInit(): void {
    // Reset the poller whenever the selected namespace changes
    this.namespaceSubscription = this.ns
      .getSelectedNamespace2()
      .subscribe(selectedNamespace => {
        this.currentNamespace = selectedNamespace;
        this.refreshInferenceServices(selectedNamespace);
        this.newEndpointButton.namespaceChanged(
          selectedNamespace,
          $localize`Endpoint`,
        );
      });
  }

  ngOnDestroy() {
    this.namespaceSubscription.unsubscribe();
    this.pollingSubscription.unsubscribe();
  }

  public refreshInferenceServices(namespace: string | string[]) {
    this.pollingSubscription.unsubscribe();
    this.inferenceServices = [];

    const request = this.backend.getInferenceServices(namespace);

    this.pollingSubscription = this.poller
      .exponential(request)
      .subscribe(inferenceServiceList => {
        this.inferenceServices = this.processIncomingData(inferenceServiceList);
      });
  }

  // action handling functions
  public reactToAction(action: ActionEvent) {
    const inferenceService = action.data as InferenceServiceIR;

    switch (action.action) {
      case 'delete':
        this.deleteClicked(inferenceService);
        break;
      case 'copy-link':
        console.log(`Copied to clipboard: ${inferenceService.status.url}`);
        this.clipboard.copy(inferenceService.status.url);
        const snackBarConfig: SnackBarConfig = {
          data: {
            msg: `Copied: ${inferenceService.status.url}`,
            snackType: SnackType.Info,
          },
        };
        this.snack.open(snackBarConfig);
        break;
      case 'name:link':
        /*
         * don't allow the user to navigate to the details page of a server
         * that is being deleted
         */
        if (inferenceService.ui.status.phase === STATUS_TYPE.TERMINATING) {
          action.event.stopPropagation();
          action.event.preventDefault();
          const snackBarConfig: SnackBarConfig = {
            data: {
              msg: $localize`Endpoint is being deleted, cannot show details.`,
              snackType: SnackType.Info,
            },
          };
          this.snack.open(snackBarConfig);
          return;
        }
        break;
    }
  }

  private deleteClicked(inferenceService: InferenceServiceIR) {
    const dialogConfig = generateDeleteConfig(inferenceService);

    const dialogRef = this.confirmDialog.open('Endpoint', dialogConfig);
    const applyingSubscription =
      dialogRef.componentInstance.applying$.subscribe(applying => {
        if (!applying) {
          return;
        }

        this.backend.deleteInferenceService(inferenceService).subscribe(
          () => {
            dialogRef.close(DIALOG_RESP.ACCEPT);
          },
          error => {
            dialogConfig.error = error;
            dialogRef.componentInstance.applying$.next(false);
          },
        );
      });

    dialogRef.afterClosed().subscribe(dialogResponse => {
      applyingSubscription.unsubscribe();

      if (dialogResponse !== DIALOG_RESP.ACCEPT) {
        return;
      }

      inferenceService.ui.status.phase = STATUS_TYPE.TERMINATING;
      inferenceService.ui.status.message = $localize`Preparing to delete Endpoint...`;
    });
  }

  // functions for converting the response InferenceServices to the
  // Internal Representation objects
  private processIncomingData(inferenceServices: InferenceServiceK8s[]) {
    const inferenceServicesCopy: InferenceServiceIR[] = JSON.parse(
      JSON.stringify(inferenceServices),
    );

    for (const inferenceService of inferenceServicesCopy) {
      this.parseInferenceService(inferenceService);
    }

    return inferenceServicesCopy;
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
  public trackInferenceService(
    index: number,
    inferenceService: InferenceServiceK8s,
  ) {
    return `${inferenceService.metadata.name}/${inferenceService.metadata.creationTimestamp}`;
  }
}
