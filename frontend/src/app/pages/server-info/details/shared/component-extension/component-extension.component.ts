import { Component, Input } from '@angular/core';
import { ComponentExtensionSpec } from 'src/app/types/kfserving/v1beta1';

@Component({
  selector: 'app-component-extension',
  templateUrl: './component-extension.component.html',
  styleUrls: ['./component-extension.component.scss'],
})
export class ComponentExtensionComponent {
  @Input() ext: ComponentExtensionSpec;
}
