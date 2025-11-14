import { Component, Input } from '@angular/core';
import { ListEntry, ChipDescriptor } from 'kubeflow';
import {
  getPredictorType,
  getPredictorExtensionSpec,
  getPredictorRuntime,
} from 'src/app/shared/utils';
import {
  InferenceServiceK8s,
  PredictorSpec,
  PredictorExtensionSpec,
} from 'src/app/types/kfserving/v1beta1';
import { InferenceServiceOwnedObjects } from 'src/app/types/backend';

@Component({
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss'],
})
export class OverviewComponent {
  public svcPropsList: ListEntry[] = [];
  public components: ChipDescriptor[];

  @Input() namespace: string;
  @Input()
  set inferenceService(s: InferenceServiceK8s) {
    this.inferenceServicePrivate = s;

    this.components = this.generateDefaultComponents(this.inferenceService);
  }
  get inferenceService(): InferenceServiceK8s {
    return this.inferenceServicePrivate;
  }

  @Input() ownedObjects: InferenceServiceOwnedObjects;

  private inferenceServicePrivate: InferenceServiceK8s;

  get externalUrl() {
    if (!this.inferenceService.status) {
      return 'InferenceService is not ready to receive traffic yet.';
    }

    return this.inferenceService.status.url !== undefined
      ? this.inferenceService.status.url
      : 'InferenceService is not ready to receive traffic yet.';
  }

  get internalUrl() {
    const msg = 'InferenceService is not ready to receive traffic yet.';

    if (
      !this.inferenceService.status ||
      !this.inferenceService.status.address
    ) {
      return msg;
    }

    return this.inferenceService.status.address.url !== undefined
      ? this.inferenceService.status.address.url
      : msg;
  }

  get predictor(): PredictorSpec {
    return this.inferenceService.spec.predictor;
  }

  get basePredictor(): PredictorExtensionSpec {
    return getPredictorExtensionSpec(this.inferenceService.spec.predictor);
  }

  get predictorType(): string {
    return getPredictorType(this.inferenceService.spec.predictor);
  }

  get predictorRuntime(): string {
    return getPredictorRuntime(this.inferenceService.spec.predictor);
  }

  private generateDefaultComponents(
    inferenceService: InferenceServiceK8s,
  ): ChipDescriptor[] {
    const chips = [];

    for (const c of ['predictor', 'transformer', 'explainer']) {
      if (c in inferenceService.spec) {
        chips.push({
          value: c,
          color: 'primary',
        });
      }
    }

    return chips;
  }
}
