import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { dump } from 'js-yaml';
import {
  NamespaceService,
  ExponentialBackoff,
  ToolbarButton,
  ConfirmDialogService,
  DIALOG_RESP,
  SnackBarService,
  SnackType,
  SnackBarConfig,
  Status,
} from 'kubeflow';
import { MWABackendService } from 'src/app/services/backend.service';
import {
  InferenceGraphK8s,
  getInferenceGraphStatus,
  getRootRouterType,
  getNodeCount,
} from 'src/app/types/kfserving/v1alpha1';
import { generateDeleteConfig } from '../config';
import { EventObject } from 'src/app/types/event';

@Component({
  selector: 'app-graph-info',
  templateUrl: './graph-info.component.html',
  styleUrls: ['./graph-info.component.scss'],
})
export class GraphInfoComponent implements OnInit, OnDestroy {
  public graphName: string;
  public namespace: string;
  public graphInfoLoaded = false;
  public inferenceGraph: InferenceGraphK8s;
  public status: Status;
  public events: EventObject[] = [];
  private yamlData = '';

  public get yaml(): string {
    return this.yamlData;
  }

  public buttonsConfig: ToolbarButton[] = [
    new ToolbarButton({
      text: $localize`EDIT`,
      icon: 'edit',
      fn: () => {
        this.editInferenceGraph();
      },
    }),
    new ToolbarButton({
      text: $localize`DELETE`,
      icon: 'delete',
      fn: () => {
        this.deleteInferenceGraph();
      },
    }),
  ];

  private poller = new ExponentialBackoff({
    interval: 4000,
    maxInterval: 4001,
    retries: 1,
  });
  private pollingSubscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ns: NamespaceService,
    private backend: MWABackendService,
    private confirmDialog: ConfirmDialogService,
    private snack: SnackBarService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.ns.updateSelectedNamespace(params.namespace);

      this.graphName = params.name;
      this.namespace = params.namespace;

      // Initial load before starting polling
      this.getBackendObjects();

      this.pollingSubscription = this.poller.start().subscribe(() => {
        this.getBackendObjects();
      }) as any;
    });
  }

  ngOnDestroy() {
    this.pollingSubscription.unsubscribe();
  }

  public navigateBack() {
    this.router.navigate(['/inference-graphs']);
  }

  public editInferenceGraph() {
    this.router.navigate(['/edit-graph', this.namespace, this.graphName]);
  }

  private getBackendObjects() {
    this.backend.getInferenceGraph(this.namespace, this.graphName).subscribe(
      graph => {
        this.inferenceGraph = graph;
        this.status = getInferenceGraphStatus(graph);
        this.yamlData = dump(graph);

        // Load events
        this.backend.getInferenceGraphEvents(graph).subscribe(
          events => {
            this.events = events || [];
            this.cdr.detectChanges();
          },
          err => {
            console.warn('Could not load events:', err);
            this.events = [];
            this.cdr.detectChanges();
          },
        );

        this.graphInfoLoaded = true;
        this.cdr.detectChanges();
      },
      err => {
        console.error('Error loading inference graph:', err);
        this.graphInfoLoaded = true;
        this.cdr.detectChanges();
      },
    );
  }

  private deleteInferenceGraph() {
    const dialogConfiguration = generateDeleteConfig(this.inferenceGraph);

    const dialogRef = this.confirmDialog.open(
      'InferenceGraph',
      dialogConfiguration,
    );
    const applyingSub = dialogRef.componentInstance.applying$.subscribe(
      applying => {
        if (!applying) {
          return;
        }

        this.backend.deleteInferenceGraph(this.inferenceGraph).subscribe(
          dialogResponse => {
            dialogRef.close(DIALOG_RESP.ACCEPT);
            const config: SnackBarConfig = {
              data: {
                msg: $localize`InferenceGraph ${this.graphName} deleted successfully.`,
                snackType: SnackType.Success,
              },
              duration: 3000,
            };
            this.snack.open(config);
            this.navigateBack();
          },
          err => {
            dialogConfiguration.error = err;
            dialogRef.componentInstance.applying$.next(false);
          },
        );
      },
    );
  }

  public getRootRouterType(): string {
    return getRootRouterType(this.inferenceGraph);
  }

  public getNodeCount(): number {
    return getNodeCount(this.inferenceGraph);
  }

  public getNodeNames(): string[] {
    if (!this.inferenceGraph?.spec?.nodes) {
      return [];
    }
    return Object.keys(this.inferenceGraph.spec.nodes);
  }

  public getNodeSteps(nodeName: string): any[] {
    if (!this.inferenceGraph?.spec?.nodes?.[nodeName]?.steps) {
      return [];
    }
    return this.inferenceGraph.spec.nodes[nodeName].steps;
  }

  public getStepDescription(step: any): string {
    const parts: string[] = [];
    if (step.name) {
      parts.push(`Name: ${step.name}`);
    }
    if (step.serviceName) {
      parts.push(`Service: ${step.serviceName}`);
    }
    if (step.nodeName) {
      parts.push(`Node: ${step.nodeName}`);
    }
    if (step.serviceUrl) {
      parts.push(`URL: ${step.serviceUrl}`);
    }
    if (step.weight) {
      parts.push(`Weight: ${step.weight}`);
    }
    if (step.condition) {
      parts.push(`Condition: ${step.condition}`);
    }
    return parts.join(', ') || 'No details';
  }
}
