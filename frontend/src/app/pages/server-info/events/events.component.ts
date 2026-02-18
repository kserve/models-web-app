import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { PollerService } from 'kubeflow';
import { Subscription } from 'rxjs';
import { MWABackendService } from 'src/app/services/backend.service';
import { ConfigService } from 'src/app/services/config.service';
import { SSEService } from 'src/app/services/sse.service';
import { defaultConfig } from './config';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { EventObject } from '../../../types/event';

@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss'],
})
export class EventsComponent implements OnInit, OnDestroy {
  public events: EventObject[] = [];
  public config = defaultConfig;
  private pollingSubscription = new Subscription();
  private sseSubscription = new Subscription();
  private inferenceServicePrivate: InferenceServiceK8s;
  private sseEnabled = false;

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
    private configService: ConfigService,
    private sseService: SSEService,
  ) {}

  ngOnInit(): void {
    this.configService.getConfig().subscribe(config => {
      this.sseEnabled = config.sseEnabled !== false;
    });
  }

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

    if (this.sseEnabled) {
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
            } else if (
              event.type === 'DELETED' &&
              event.object?.metadata?.uid
            ) {
              // Remove deleted event from the list
              this.events = this.events.filter(
                e => e.metadata?.uid !== event.object?.metadata?.uid,
              );
            } else if (event.type === 'ERROR') {
              console.error('SSE error event received:', event.message);
              this.fallbackToPolling(inferenceService);
            }
          },
          error => {
            console.error(
              'SSE connection error, falling back to polling:',
              error,
            );
            this.fallbackToPolling(inferenceService);
          },
        );
    } else {
      this.fallbackToPolling(inferenceService);
    }
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
