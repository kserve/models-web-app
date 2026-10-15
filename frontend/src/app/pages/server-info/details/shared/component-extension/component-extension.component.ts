import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ComponentExtensionSpec } from 'src/app/types/kfserving/v1beta1';

@Component({
  standalone: false,
  selector: 'app-component-extension',
  templateUrl: './component-extension.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./component-extension.component.scss'],
})
export class ComponentExtensionComponent {
  @Input() ext: ComponentExtensionSpec;
}
