import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { TableColumnComponent } from 'kubeflow';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { StorageUriComponent } from '../storage-uri/storage-uri.component';
import { getPredictorExtensionSpec } from '../utils';

@Component({
  standalone: false,
  selector: 'app-storage-uri-column',
  templateUrl: './storage-uri-column.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./storage-uri-column.component.scss'],
})
export class StorageUriColumnComponent
  extends StorageUriComponent
  implements TableColumnComponent
{
  set element(inferenceService: InferenceServiceK8s) {
    this.basePredictor = getPredictorExtensionSpec(
      inferenceService.spec.predictor,
    );
    this.namespace = inferenceService.metadata.namespace;
  }
}
