import { Component, Input, OnDestroy } from '@angular/core';
import { PollerService } from 'kubeflow';
import { Subscription } from 'rxjs';
import { MWABackendService } from 'src/app/services/backend.service';
import { SSEService } from 'src/app/services/sse.service';
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
  private sseSubscription = new Subscription();
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
    private sseService: SSEService,
  ) {}

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
    }
  }

  private poll(inferenceService: InferenceServiceK8s) {
    this.pollingSubscription?.unsubscribe();
    this.sseSubscription?.unsubscribe();

    if (!inferenceService) {
      return;
    }

    const namespace = inferenceService.metadata.namespace;
    const name = inferenceService.metadata.name;

    // Use SSE for real-time event updates
    this.sseSubscription = this.sseService
      .watchEvents<EventObject>(namespace, name)
      .subscribe(
        event => {
          if (event.type === 'INITIAL' && event.items) {
            this.events = event.items;
          } else if (event.type === 'ADDED' && event.object) {
            this.events = [...this.events, event.object];
          } else if (
            event.type === 'MODIFIED' &&
            event.object &&
            event.object.metadata
          ) {
            const index = this.events.findIndex(
              e => e.metadata?.uid === event.object?.metadata?.uid,
            );
            if (index !== -1) {
              this.events[index] = event.object;
              this.events = [...this.events];
            }
          } else if (event.type === 'DELETED' && event.object?.metadata?.uid) {
            // Remove deleted event from the list
            this.events = this.events.filter(
              e => e.metadata?.uid !== event.object?.metadata?.uid,
            );
          } else if (event.type === 'ERROR') {
            this.fallbackToPolling(inferenceService);
          }
        },
        error => {
          this.fallbackToPolling(inferenceService);
        },
      );
  }

  private fallbackToPolling(inferenceService: InferenceServiceK8s) {
    const request = this.backend.getInferenceServiceEvents(inferenceService);

    this.pollingSubscription = this.poller
      .exponential(request)
      .subscribe(events => {
        this.events = events;
      });
  }
}
