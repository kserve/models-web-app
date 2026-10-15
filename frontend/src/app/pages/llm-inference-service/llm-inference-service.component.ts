import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';
import {
  LLMInferenceServiceK8s,
  LLMInferenceServiceIR,
} from 'src/app/types/kfserving/llm-inference-service';
import {
  deriveTopology,
  getLLMInferenceServiceStatus,
  summarizeParallelism,
  summarizeRouter,
} from 'src/app/shared/llm-inference-service.utils';
import { environment } from 'src/environments/environment';
import {
  NamespaceService,
  STATUS_TYPE,
  ActionEvent,
  SnackBarService,
  SnackType,
  DashboardState,
  ToolbarButton,
  SnackBarConfig,
  PollerService,
} from 'kubeflow';
import { Subscription } from 'rxjs';
import { defaultConfig } from './config';
import { Router } from '@angular/router';

@Component({
  standalone: false,
  selector: 'app-llm-inference-service',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './llm-inference-service.component.html',
})
export class LLMInferenceServiceComponent implements OnInit, OnDestroy {
  env = environment;

  namespaceSubscription = new Subscription();
  dashboardSubscription = new Subscription();
  pollingSubscription = new Subscription();

  currentNamespace: string | string[];
  config = defaultConfig;
  llmInferenceServices: LLMInferenceServiceIR[] = [];

  dashboardDisconnectedState = DashboardState.Disconnected;

  private viewEndpointsButton = new ToolbarButton({
    text: $localize`View Endpoints`,
    icon: 'cloud_upload',
    stroked: true,
    fn: () => {
      this.router.navigate(['/']);
    },
  });

  buttons: ToolbarButton[] = [this.viewEndpointsButton];

  constructor(
    private backend: MWABackendService,
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
    this.llmInferenceServices = [];

    const request = this.backend.getLLMInferenceServices(namespace);

    this.pollingSubscription = this.poller
      .exponential(request)
      .subscribe((services: LLMInferenceServiceK8s[]) => {
        this.llmInferenceServices = this.processIncomingData(services);
      });
  }

  public reactToAction(actionEvent: ActionEvent) {
    const llmInferenceService = actionEvent.data as LLMInferenceServiceIR;

    if (actionEvent.action === 'name:link') {
      /*
       * Do not allow the user to navigate to the details page of an
       * object that is being deleted.
       */
      if (llmInferenceService.ui?.status?.phase === STATUS_TYPE.TERMINATING) {
        actionEvent.event?.stopPropagation();
        actionEvent.event?.preventDefault();
        const snackConfiguration: SnackBarConfig = {
          data: {
            msg: $localize`LLMInferenceService is being deleted, cannot show details.`,
            snackType: SnackType.Info,
          },
        };
        this.snack.open(snackConfiguration);
      }
    }
  }

  // functions for converting the response objects to the
  // internal representation objects
  private processIncomingData(services: LLMInferenceServiceK8s[]) {
    const servicesCopy: LLMInferenceServiceIR[] = JSON.parse(
      JSON.stringify(services),
    );

    for (const llmInferenceService of servicesCopy) {
      this.parseLLMInferenceService(llmInferenceService);
    }

    return servicesCopy;
  }

  private parseLLMInferenceService(llmInferenceService: LLMInferenceServiceIR) {
    const specification = llmInferenceService.spec;

    llmInferenceService.ui = {
      status: getLLMInferenceServiceStatus(llmInferenceService),
      topology: deriveTopology(llmInferenceService),
      parallelism: summarizeParallelism(specification),
      router: summarizeRouter(specification),
      modelName: specification?.model?.name || specification?.model?.uri || '',
      link: {
        text: llmInferenceService.metadata.name,
        url: `/llm-details/${llmInferenceService.metadata.namespace}/${llmInferenceService.metadata.name}`,
      },
    };
  }

  // util functions
  public llmInferenceServiceTrackByFn(
    index: number,
    llmInferenceService: LLMInferenceServiceK8s,
  ) {
    return `${llmInferenceService.metadata.name}/${llmInferenceService.metadata.creationTimestamp}`;
  }
}
