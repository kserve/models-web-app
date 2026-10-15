import {
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { PredictorExtensionSpec } from 'src/app/types/kfserving/v1beta1';

@Component({
  standalone: false,
  selector: 'app-storage-uri',
  templateUrl: './storage-uri.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
