import { Component, Input, OnInit } from '@angular/core';
import { PredictorExtensionSpec } from 'src/app/types/kfserving/v1beta1';

@Component({
  selector: 'app-storage-uri',
  templateUrl: './storage-uri.component.html',
  styleUrls: ['./storage-uri.component.scss'],
})
export class StorageUriComponent {
  @Input() namespace: string;
  @Input() basePredictor: PredictorExtensionSpec;

  constructor() {}

  isPVC(uri: string): boolean {
    return uri?.slice(0, 6) === 'pvc://';
  }

  getPVCUrl(uri: string, ns: string): string {
    const splitUrls = uri.split('/');
    const pvcName = splitUrls[2];
    return `/volumes/volume/details/${ns}/${pvcName}`;
  }
}
