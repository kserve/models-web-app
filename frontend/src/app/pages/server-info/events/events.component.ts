import { Component, Input, OnDestroy } from '@angular/core';
import { PollerService } from 'kubeflow';
import { Subscription } from 'rxjs';
import { MWABackendService } from 'src/app/services/backend.service';
import { defaultConfig } from './config';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { EventObject } from '../../../types/event';

@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss'],
})
export class EventsComponent implements OnDestroy {
  public events: EventObject[] = [];
  public config = defaultConfig;
  private pollingSubscription = new Subscription();
  private inferenceServicePrivate: InferenceServiceK8s;

  @Input()
  set inferenceService(s: InferenceServiceK8s) {
    this.inferenceServicePrivate = s;
    this.poll(s);
  }
  get inferenceService(): InferenceServiceK8s {
    return this.inferenceServicePrivate;
  }

  constructor(
    public backend: MWABackendService,
    public poller: PollerService,
  ) {}

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  private poll(inferenceService: InferenceServiceK8s) {
    this.pollingSubscription.unsubscribe();

    const request = this.backend.getInferenceServiceEvents(inferenceService);

    this.pollingSubscription = this.poller
      .exponential(request)
      .subscribe(events => {
        this.events = events;
      });
  }
}
