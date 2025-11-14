import { Component, Input, OnDestroy } from '@angular/core';
import { MWABackendService } from 'src/app/services/backend.service';
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
export class LogsComponent implements OnDestroy {
  public goToBottom = true;
  public currentLogs: InferenceServiceLogs = {};
  public logsRequestCompleted = false;
  public loadErrorMsg = '';

  @Input()
  set inferenceService(s: InferenceServiceK8s) {
    this.inferenceServicePrivate = s;

    if (!s) {
      return;
    }

    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }

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

  get logsNotEmpty(): boolean {
    return !dictIsEmpty(this.currentLogs);
  }

  private inferenceServicePrivate: InferenceServiceK8s;
  private components: [string, string][] = [];
  private pollingSubscription: Subscription;
  private poller = new ExponentialBackoff({
    interval: 3000,
    retries: 1,
    maxInterval: 3001,
  });

  constructor(public backend: MWABackendService) {}

  ngOnDestroy() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  logsTrackFn(i: number, podLogs: any) {
    return podLogs.podName;
  }
}
