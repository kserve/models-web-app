import { Component, OnInit } from '@angular/core';
import { TableColumnComponent } from 'kubeflow/lib/resource-table/component-value/component-value.component';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { StorageUriComponent } from '../storage-uri/storage-uri.component';
import { getPredictorExtensionSpec } from '../utils';

@Component({
  selector: 'app-storage-uri-column',
  templateUrl: './storage-uri-column.component.html',
  styleUrls: ['./storage-uri-column.component.scss'],
})
export class StorageUriColumnComponent
  extends StorageUriComponent
  implements TableColumnComponent
{
  set element(inferenceService: InferenceServiceK8s) {
    this.basePredictor = getPredictorExtensionSpec(inferenceService.spec.predictor);
    this.namespace = inferenceService.metadata.namespace;
  }
}
