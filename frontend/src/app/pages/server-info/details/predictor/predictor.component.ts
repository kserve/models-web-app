import { Component, Input } from '@angular/core';
import {
  PredictorSpec,
  PredictorExtensionSpec,
} from 'src/app/types/kfserving/v1beta1';
import {
  getPredictorExtensionSpec,
  getPredictorRuntime,
  getPredictorType,
} from 'src/app/shared/utils';

@Component({
  selector: 'app-predictor-details',
  templateUrl: './predictor.component.html',
})
export class PredictorDetailsComponent {
  @Input() predictorSpec: PredictorSpec;
  @Input() namespace: string;

  get basePredictor(): PredictorExtensionSpec {
    return getPredictorExtensionSpec(this.predictorSpec);
  }

  get predictorType(): string {
    return getPredictorType(this.predictorSpec);
  }

  get predictorRuntime(): string {
    return getPredictorRuntime(this.predictorSpec);
  }
}
