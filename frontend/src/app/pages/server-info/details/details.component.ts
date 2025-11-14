import { Component, Input } from '@angular/core';
import { ListEntry, ChipDescriptor } from 'kubeflow';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
})
export class DetailsComponent {
  public svcPropsList: ListEntry[] = [];
  public annotations: ChipDescriptor[] = [];
  public labels: ChipDescriptor[] = [];

  @Input() namespace: string;
  @Input()
  set inferenceService(s: InferenceServiceK8s) {
    this.inferenceServicePrivate = s;

    this.svcPropsList = this.generateSvcPropsList();
  }
  get inferenceService(): InferenceServiceK8s {
    return this.inferenceServicePrivate;
  }

  get externalUrl() {
    if (!this.inferenceService.status) {
      return 'InferenceService is not ready to receive traffic yet.';
    }

    return this.inferenceService.status.url !== undefined
      ? this.inferenceService.status.url
      : 'InferenceService is not ready to receive traffic yet.';
  }

  private inferenceServicePrivate: InferenceServiceK8s;

  private generateSvcPropsList(): ListEntry[] {
    const props: ListEntry[] = [];

    this.annotations = this.generateAnnotations();
    this.labels = this.generateLabels();

    return props;
  }

  private generateAnnotations() {
    const chips = [];

    if (!this.inferenceService.metadata.annotations) {
      return chips;
    }

    for (const a in this.inferenceService.metadata.annotations) {
      if (!this.inferenceService.metadata.annotations.hasOwnProperty(a)) {
        continue;
      }
      const annotationKey = a;
      const annotationVal = this.inferenceService.metadata.annotations[a];
      if (annotationKey.includes('last-applied-configuration')) {
        continue;
      }
      const chip: ChipDescriptor = {
        value: `${annotationKey}: ${annotationVal}`,
        color: 'primary',
      };
      chips.push(chip);
    }

    return chips;
  }

  private generateLabels() {
    const chips = [];
    if (!this.inferenceService.metadata.labels) {
      return chips;
    }

    for (const l in this.inferenceService.metadata.labels) {
      if (!this.inferenceService.metadata.labels.hasOwnProperty(l)) {
        continue;
      }

      const labelKey = l;
      const labelVal = this.inferenceService.metadata.labels[l];

      const chip: ChipDescriptor = {
        value: `${labelKey}: ${labelVal}`,
        color: 'primary',
      };

      chips.push(chip);
    }

    return chips;
  }
}
