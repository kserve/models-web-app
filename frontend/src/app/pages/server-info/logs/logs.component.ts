import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MWABackendService } from 'src/app/services/backend.service';
import { ConfigService } from 'src/app/services/config.service';
import { SSEService } from 'src/app/services/sse.service';
import { ExponentialBackoff } from 'kubeflow';
import { Subscription } from 'rxjs';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';

enum IsvcComponent {
  predictor = 'predictor',
  transformer = 'transformer',
  explainer = 'explainer',
}

interface IsvcComponents {
  [key: string]: { containers: string[] };
}

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss'],
})
export class LogsComponent implements OnInit, OnDestroy {
  public currLogs: string[] = [];
  public logsRequestCompleted = false;
  public loadErrorMsg = '';
  private sseEnabled = false;

  public isvcComponents: IsvcComponents = {};
  private currentComponent: string;
  private currentContainer: string;
  private hasLoadedContainers = false;

  private svcPrv: InferenceServiceK8s;
  private pollingSub: Subscription;
  private sseSubscription: Subscription = new Subscription();

  @ViewChild('componentTabGroup', { static: false }) componentTabGroup;
  @ViewChild('containerTabGroup', { static: false }) containerTabGroup;

  get components() {
    return Object.keys(this.isvcComponents);
  }

  private poller = new ExponentialBackoff({
    interval: 5000,
    retries: 1,
    maxInterval: 5001,
  });

  constructor(
    public backend: MWABackendService,
    private configService: ConfigService,
    private sseService: SSEService,
  ) {}

  ngOnInit(): void {
    this.configService.getConfig().subscribe(config => {
      this.sseEnabled = config.sseEnabled !== false;
    });
  }

  @Input()
  set inferenceService(s: InferenceServiceK8s) {
    this.svcPrv = s;

    if (!s) return;

    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }

    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
    }

    this.isvcComponents = {};
    this.hasLoadedContainers = false;

    // Load components & containers
    for (const component of Object.values(IsvcComponent)) {
      if (!(component in this.svcPrv.spec)) continue;

      this.isvcComponents[component] = { containers: [] };

      this.backend
        .getInferenceServiceContainers(this.svcPrv, component)
        .subscribe(
          containers => {
            if (containers?.length) {
              if (!this.hasLoadedContainers) {
                this.currentComponent = component;
                this.currentContainer = containers[0];
                this.hasLoadedContainers = true;
              }
              this.isvcComponents[component].containers = containers;
            }
          },
          error =>
            console.error(`Error getting ${component} containers`, error),
        );
    }

    // Start log streaming or polling
    if (this.sseEnabled) {
      this.startSSE();
    } else {
      this.startPolling();
    }
  }

  private startSSE() {
    const namespace = this.svcPrv?.metadata?.namespace;
    const name = this.svcPrv?.metadata?.name;

    if (!namespace || !name) {
      this.startPolling();
      return;
    }

    this.sseSubscription = this.sseService.watchLogs(namespace, name).subscribe(
      event => {
        if (event?.type === 'UPDATE' && event.logs) {
          this.currLogs = event.logs;
          this.logsRequestCompleted = true;
          this.loadErrorMsg = '';
        } else if (event?.type === 'ERROR') {
          this.logsRequestCompleted = true;
          this.loadErrorMsg = event.message || 'Error loading logs';
        }
      },
      error => {
        console.error('SSE failed, falling back to polling:', error);
        this.startPolling();
      },
    );
  }

  private startPolling() {
    this.pollingSub = this.poller.start().subscribe(() => {
      if (!this.currentComponent || !this.currentContainer) return;

      this.backend
        .getInferenceServiceLogs(
          this.svcPrv,
          this.currentComponent,
          this.currentContainer,
        )
        .subscribe(
          logs => {
            this.currLogs = logs || [];
            this.logsRequestCompleted = true;
            this.loadErrorMsg = '';
          },
          error => {
            this.currLogs = [];
            this.logsRequestCompleted = true;
            this.loadErrorMsg = error || 'Error loading logs';
          },
        );
    });
  }

  resetLogDisplay() {
    this.logsRequestCompleted = false;
    this.currLogs = [];
    this.loadErrorMsg = '';
    this.poller.reset();
  }

  componentTabChange(index: number) {
    this.currentComponent = Object.keys(this.isvcComponents)[index];
    const containers = this.isvcComponents[this.currentComponent]?.containers;

    if (containers?.length) {
      this.currentContainer = containers[0];
    }

    this.resetLogDisplay();

    if (this.sseEnabled) {
      this.startSSE();
    }
  }

  containerTabChange(index: number) {
    const containers = this.isvcComponents[this.currentComponent]?.containers;

    if (containers?.length) {
      this.currentContainer = containers[index];
    }

    this.resetLogDisplay();

    if (this.sseEnabled) {
      this.startSSE();
    }
  }

  ngOnDestroy(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }

    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
    }
  }
}
