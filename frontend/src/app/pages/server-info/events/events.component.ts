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
  private pollSub = new Subscription();
  private svcPrv: InferenceServiceK8s;

  @Input()
  set svc(s: InferenceServiceK8s) {
    this.svcPrv = s;
    this.poll(s);
  }
  get svc(): InferenceServiceK8s {
    return this.svcPrv;
  }

  constructor(
    public backend: MWABackendService,
    public poller: PollerService,
  ) {}

  ngOnDestroy(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
    }
  }

  private poll(svc: InferenceServiceK8s) {
    this.pollSub.unsubscribe();

    const request = this.backend.getInferenceServiceEvents(svc);

    this.pollSub = this.poller.exponential(request).subscribe(events => {
      this.events = events;
    });
  }
}
