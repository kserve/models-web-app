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

  nsSub = new Subscription();
  pollSub = new Subscription();

  currNamespace: string | string[];
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
    public mwaNamespace: MWANamespaceService,
    public poller: PollerService,
  ) {}

  ngOnInit(): void {
    this.mwaNamespace.initialize().subscribe();

    this.nsSub = this.mwaNamespace.getSelectedNamespace().subscribe(ns => {
      if (ns) {
        this.currNamespace = ns;
        this.poll(ns);
        this.newEndpointButton.namespaceChanged(ns, $localize`Endpoint`);
      }
    });

    this.ns.getSelectedNamespace2().subscribe(ns => {});
  }

  ngOnDestroy() {
    this.nsSub.unsubscribe();
    this.pollSub.unsubscribe();
  }

  public poll(ns: string | string[]) {
    this.pollSub.unsubscribe();
    this.inferenceServices = [];

    const request = this.backend.getInferenceServices(ns);

    this.pollSub = this.poller.exponential(request).subscribe(svcs => {
      this.inferenceServices = this.processIncomingData(svcs);
    });
  }

  // action handling functions
  public reactToAction(a: ActionEvent) {
    const svc = a.data as InferenceServiceIR;

    switch (a.action) {
      case 'delete':
        this.deleteClicked(svc);
        break;
      case 'copy-link':
        this.clipboard.copy(svc.status.url);
        const config: SnackBarConfig = {
          data: {
            msg: `Copied: ${svc.status.url}`,
            snackType: SnackType.Info,
          },
        };
        this.snack.open(config);
        break;
      case 'name:link':
        /*
         * don't allow the user to navigate to the details page of a server
         * that is being deleted
         */
        if (svc.ui.status.phase === STATUS_TYPE.TERMINATING) {
          a.event.stopPropagation();
          a.event.preventDefault();
          const config: SnackBarConfig = {
            data: {
              msg: $localize`Endpoint is being deleted, cannot show details.`,
              snackType: SnackType.Info,
            },
          };
          this.snack.open(config);
          return;
        }
        break;
    }
  }

  private deleteClicked(svc: InferenceServiceIR) {
    const config = generateDeleteConfig(svc);

    const dialogRef = this.confirmDialog.open('Endpoint', config);
    const applyingSub = dialogRef.componentInstance.applying$.subscribe(
      applying => {
        if (!applying) {
          return;
        }

        this.backend.deleteInferenceService(svc).subscribe(
          res => {
            dialogRef.close(DIALOG_RESP.ACCEPT);
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

      svc.ui.status.phase = STATUS_TYPE.TERMINATING;
      svc.ui.status.message = $localize`Preparing to delete Endpoint...`;
    });
  }

  // functions for converting the response InferenceServices to the
  // Internal Representation objects
  private processIncomingData(svcs: InferenceServiceK8s[]) {
    const svcsCopy: InferenceServiceIR[] = JSON.parse(JSON.stringify(svcs));

    for (const svc of svcsCopy) {
      this.parseInferenceService(svc);
    }

    return svcsCopy;
  }

  private parseInferenceService(svc: InferenceServiceIR) {
    svc.ui = { actions: {} };
    svc.ui.status = getK8sObjectUiStatus(svc);
    svc.ui.actions.copy = this.getCopyActionStatus(svc);
    svc.ui.actions.delete = this.getDeletionActionStatus(svc);

    const predictorType = getPredictorType(svc.spec.predictor);
    const predictor = getPredictorExtensionSpec(svc.spec.predictor);
    svc.ui.predictorType = predictorType;
    svc.ui.runtimeVersion = predictor.runtimeVersion;
    svc.ui.storageUri = predictor.storageUri;
    svc.ui.protocolVersion = predictor.protocolVersion || 'v1';
    svc.ui.link = {
      text: svc.metadata.name,
      url: `/details/${svc.metadata.namespace}/${svc.metadata.name}`,
    };
  }

  private getCopyActionStatus(svc: InferenceServiceIR) {
    if (svc.ui.status.phase !== STATUS_TYPE.READY) {
      return STATUS_TYPE.UNAVAILABLE;
    }

    return STATUS_TYPE.READY;
  }

  private getDeletionActionStatus(svc: InferenceServiceIR) {
    if (svc.ui.status.phase !== STATUS_TYPE.TERMINATING) {
      return STATUS_TYPE.READY;
    }

    return STATUS_TYPE.TERMINATING;
  }

  // util functions
  public inferenceServiceTrackByFn(index: number, svc: InferenceServiceK8s) {
    return `${svc.metadata.name}/${svc.metadata.creationTimestamp}`;
  }
}
