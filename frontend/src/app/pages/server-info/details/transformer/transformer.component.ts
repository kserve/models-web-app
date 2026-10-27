import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { TransformerSpec } from 'src/app/types/kfserving/v1beta1';

@Component({
  standalone: false,
  selector: 'app-transformer-details',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './transformer.component.html',
})
export class TransformerComponent {
  @Input() transformerSpec: TransformerSpec;
}
