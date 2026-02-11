import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { MWABackendService } from 'src/app/services/backend.service';
import { ExponentialBackoff } from 'kubeflow';
import { Subscription } from 'rxjs';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';

enum IsvcComponent {
  predictor = 'predictor',
  transformer = 'transformer',
  explainer = 'explainer',
}

interface IsvcComponents {
  IsvcComponent?: { containers: string[] };
}

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss'],
})
export class LogsComponent implements OnDestroy {
  public currLogs: string[] = [];
  public logsRequestCompleted = false;
  public loadErrorMsg = '';

  public isvcComponents: IsvcComponents = {};
  private currentComponent: string;
  private currentContainer: string;
  private hasLoadedContainers = false;

  @ViewChild('componentTabGroup', { static: false }) componentTabGroup;
  @ViewChild('containerTabGroup', { static: false }) containerTabGroup;

  get components() {
    return Object.keys(this.isvcComponents);
  }

  @Input()
  set inferenceService(s: InferenceServiceK8s) {
    this.svcPrv = s;

    if (!s) {
      return;
    }

    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }

    for (const component of Object.keys(IsvcComponent)) {
      if (!(component in this.svcPrv.spec)) {
        continue;
      }

      this.isvcComponents[component] = { containers: [] };

      this.backend
        .getInferenceServiceContainers(this.svcPrv, component)
        .subscribe(
          containers => {
            if (!this.hasLoadedContainers) {
              this.currentComponent = component;
              this.currentContainer = containers[0];
              this.hasLoadedContainers = true;
            }
            this.isvcComponents[component].containers = containers;
          },
          error => {
            console.log(`error getting ${component} containers'`, error);
          },
        );
    }

    this.pollingSub = this.poller.start().subscribe(() => {
      if (!this.currentComponent || !this.currentContainer) {
        return;
      }

      this.backend
        .getInferenceServiceLogs(
          this.svcPrv,
          this.currentComponent,
          this.currentContainer,
        )
        .subscribe(
          logs => {
            this.currLogs = logs;
            this.logsRequestCompleted = true;
            this.loadErrorMsg = '';
          },
          error => {
            this.currLogs = [];
            this.logsRequestCompleted = true;
            this.loadErrorMsg = error;
          },
        );
    });
  }

  private svcPrv: InferenceServiceK8s;
  private pollingSub: Subscription;
  private poller = new ExponentialBackoff({
    interval: 5000,
    retries: 1,
    maxInterval: 5001,
  });

  constructor(public backend: MWABackendService) {}

  resetLogDisplay() {
    this.logsRequestCompleted = false;
    this.currLogs = [];
    this.loadErrorMsg = '';
    this.poller.reset();
  }

  componentTabChange(index: number) {
    this.currentComponent = Object.keys(this.isvcComponents)[index];

    if (
      !(
        this.currentContainer in
        this.isvcComponents[this.currentComponent].containers
      )
    ) {
      this.currentContainer =
        this.isvcComponents[this.currentComponent].containers[0];
    }

    this.resetLogDisplay();
  }

  containerTabChange(index: number) {
    this.currentContainer =
      this.isvcComponents[this.currentComponent].containers[index];
    this.resetLogDisplay();
  }

  ngOnDestroy() {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }
}
