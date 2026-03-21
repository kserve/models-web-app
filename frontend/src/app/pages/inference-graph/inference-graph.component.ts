import { Component, OnInit, OnDestroy } from '@angular/core';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';
import {
  InferenceGraphK8s,
  InferenceGraphIR,
  getInferenceGraphStatus,
  getRootRouterType,
  getNodeCount,
} from 'src/app/types/kfserving/v1alpha1';
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

@Component({
  selector: 'app-inference-graph',
  templateUrl: './inference-graph.component.html',
})
export class InferenceGraphComponent implements OnInit, OnDestroy {
  env = environment;

  namespaceSubscription = new Subscription();
  dashboardSubscription = new Subscription();
  pollingSubscription = new Subscription();

  currentNamespace: string | string[];
  config = defaultConfig;
  inferenceGraphs: InferenceGraphIR[] = [];

  dashboardDisconnectedState = DashboardState.Disconnected;

  private newGraphButton = new ToolbarButton({
    text: $localize`New InferenceGraph`,
    icon: 'add',
    stroked: true,
    fn: () => {
      this.router.navigate(['/new-graph']);
    },
  });

  private viewEndpointsButton = new ToolbarButton({
    text: $localize`View Endpoints`,
    icon: 'cloud_upload',
    stroked: true,
    fn: () => {
      this.router.navigate(['/']);
    },
  });

  buttons: ToolbarButton[] = [this.viewEndpointsButton, this.newGraphButton];

  constructor(
    private backend: MWABackendService,
    private confirmDialog: ConfirmDialogService,
    private snack: SnackBarService,
    private router: Router,
    public namespaceService: NamespaceService,
    public mwaNamespace: MWANamespaceService,
    public poller: PollerService,
  ) {}

  ngOnInit(): void {
    this.dashboardSubscription =
      this.namespaceService.dashboardConnected$.subscribe(dashboardState => {
        this.namespaceSubscription.unsubscribe();

        if (dashboardState === DashboardState.Disconnected) {
          // Standalone mode: use MWANamespaceService for namespace selection
          this.namespaceSubscription = this.mwaNamespace
            .getSelectedNamespace()
            .subscribe(selectedNamespace => {
              if (!selectedNamespace) {
                return;
              }
              this.currentNamespace = selectedNamespace;
              this.poll(selectedNamespace);
              this.newGraphButton.namespaceChanged(
                selectedNamespace,
                $localize`InferenceGraph`,
              );
            });
          this.mwaNamespace.initialize().subscribe();
        } else {
          // Kubeflow mode: use the central dashboard NamespaceService
          this.namespaceSubscription = this.namespaceService
            .getSelectedNamespace()
            .subscribe(selectedNamespace => {
              if (!selectedNamespace) {
                return;
              }
              this.currentNamespace = selectedNamespace;
              this.poll(selectedNamespace);
              this.newGraphButton.namespaceChanged(
                selectedNamespace,
                $localize`InferenceGraph`,
              );
            });
        }
      });
  }

  ngOnDestroy() {
    this.namespaceSubscription.unsubscribe();
    this.dashboardSubscription.unsubscribe();
    this.pollingSubscription.unsubscribe();
  }

  public poll(namespace: string | string[]) {
    this.pollingSubscription.unsubscribe();
    this.inferenceGraphs = [];

    if (!this.env.production) {
      console.log('InferenceGraph: Polling for namespace:', namespace);
    }

    const request = this.backend.getInferenceGraphs(namespace);

    this.pollingSubscription = this.poller
      .exponential(request)
      .subscribe((graphs: InferenceGraphK8s[]) => {
        if (!this.env.production) {
          console.log('InferenceGraph: Received graphs:', graphs);
        }
        this.inferenceGraphs = this.processIncomingData(graphs);
        if (!this.env.production) {
          console.log(
            'InferenceGraph: Processed graphs:',
            this.inferenceGraphs,
          );
        }
      });
  }

  // action handling functions
  public reactToAction(a: ActionEvent) {
    const inferenceGraph = a.data as InferenceGraphIR;

    switch (a.action) {
      case 'delete':
        this.deleteClicked(inferenceGraph);
        break;
      case 'name:link':
        /*
         * don't allow the user to navigate to the details page of a graph
         * that is being deleted
         */
        if (inferenceGraph.ui.status.phase === STATUS_TYPE.TERMINATING) {
          a.event.stopPropagation();
          a.event.preventDefault();
          const snackConfiguration: SnackBarConfig = {
            data: {
              msg: $localize`InferenceGraph is being deleted, cannot show details.`,
              snackType: SnackType.Info,
            },
          };
          this.snack.open(snackConfiguration);
          return;
        }
        break;
    }
  }

  private deleteClicked(inferenceGraph: InferenceGraphIR) {
    const dialogConfiguration = generateDeleteConfig(inferenceGraph);

    const dialogRef = this.confirmDialog.open(
      'InferenceGraph',
      dialogConfiguration,
    );
    const applyingSub = dialogRef.componentInstance.applying$.subscribe(
      applying => {
        if (!applying) {
          return;
        }

        this.backend.deleteInferenceGraph(inferenceGraph).subscribe(
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

      inferenceGraph.ui.status.phase = STATUS_TYPE.TERMINATING;
      inferenceGraph.ui.status.message = $localize`Preparing to delete InferenceGraph...`;
    });
  }

  // functions for converting the response InferenceGraphs to the
  // Internal Representation objects
  private processIncomingData(graphs: InferenceGraphK8s[]) {
    const graphsCopy: InferenceGraphIR[] = JSON.parse(JSON.stringify(graphs));

    for (const inferenceGraph of graphsCopy) {
      this.parseInferenceGraph(inferenceGraph);
    }

    return graphsCopy;
  }

  private parseInferenceGraph(inferenceGraph: InferenceGraphIR) {
    inferenceGraph.ui = { actions: {} };
    inferenceGraph.ui.status = getInferenceGraphStatus(inferenceGraph);
    inferenceGraph.ui.actions.delete =
      this.getDeletionActionStatus(inferenceGraph);

    inferenceGraph.ui.routerType = getRootRouterType(inferenceGraph);
    inferenceGraph.ui.nodeCount = getNodeCount(inferenceGraph);
    inferenceGraph.ui.link = {
      text: inferenceGraph.metadata.name,
      url: `/graph-details/${inferenceGraph.metadata.namespace}/${inferenceGraph.metadata.name}`,
    };
  }

  private getDeletionActionStatus(inferenceGraph: InferenceGraphIR) {
    if (inferenceGraph.ui.status.phase !== STATUS_TYPE.TERMINATING) {
      return STATUS_TYPE.READY;
    }

    return STATUS_TYPE.TERMINATING;
  }

  // util functions
  public inferenceGraphTrackByFn(
    index: number,
    inferenceGraph: InferenceGraphK8s,
  ) {
    return `${inferenceGraph.metadata.name}/${inferenceGraph.metadata.creationTimestamp}`;
  }
}
