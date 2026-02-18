import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MWABackendService } from 'src/app/services/backend.service';
import { ConfigService } from 'src/app/services/config.service';
import { SSEService } from 'src/app/services/sse.service';
import { ExponentialBackoff } from 'kubeflow';
import { Subscription } from 'rxjs';
import { InferenceServiceLogs } from 'src/app/types/backend';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { dictIsEmpty } from 'src/app/shared/utils';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss'],
})
export class LogsComponent implements OnInit, OnDestroy {
  public goToBottom = true;
  public currentLogs: InferenceServiceLogs = {};
  public logsRequestCompleted = false;
  public loadErrorMsg = '';
  private sseEnabled = false;

  @Input()
  set inferenceService(s: InferenceServiceK8s) {
    this.inferenceServicePrivate = s;

    if (!s) {
      return;
    }

    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }

    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
    }

    const namespace = s.metadata.namespace;
    const name = s.metadata.name;

    if (this.sseEnabled) {
      // Use SSE for real-time log streaming
      this.sseSubscription = this.sseService
        .watchLogs(namespace, name)
        .subscribe(
          event => {
            if (event.type === 'UPDATE' && event.logs) {
              this.currentLogs = event.logs;
              this.logsRequestCompleted = true;
              this.loadErrorMsg = '';
            } else if (event.type === 'ERROR' && event.message) {
              this.logsRequestCompleted = true;
              this.loadErrorMsg = event.message;
            }
          },
          error => {
            console.error(
              'SSE log streaming error, falling back to polling:',
              error,
            );
            this.startPolling(s);
          },
        );
    } else {
      this.startPolling(s);
    }
  }

  get logsNotEmpty(): boolean {
    return !dictIsEmpty(this.currentLogs);
  }

  private inferenceServicePrivate: InferenceServiceK8s;
  private components: [string, string][] = [];
  private pollingSubscription: Subscription;
  private sseSubscription = new Subscription();
  private poller = new ExponentialBackoff({
    interval: 3000,
    retries: 1,
    maxInterval: 3001,
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

  ngOnDestroy() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
    }
  }

  private startPolling(s: InferenceServiceK8s) {
    this.pollingSubscription = this.poller.start().subscribe(() => {
      this.backend.getInferenceServiceLogs(s).subscribe(
        logs => {
          this.currentLogs = logs;
          this.logsRequestCompleted = true;
          this.loadErrorMsg = '';
        },
        error => {
          this.logsRequestCompleted = true;
          this.loadErrorMsg = error;
        },
      );
    });
  }

  logsTrackFn(i: number, podLogs: any) {
    return podLogs.podName;
  }
}
