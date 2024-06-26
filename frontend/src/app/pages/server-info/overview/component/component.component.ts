import { Component, Input } from '@angular/core';
import { ComponentStatusSpec } from 'src/app/types/kfserving/v1beta1';
import { ComponentOwnedObjects } from 'src/app/types/backend';

@Component({
  selector: 'app-serving-component-overview',
  templateUrl: './component.component.html',
  styleUrls: ['./component.component.scss'],
})
export class ComponentOverviewComponent {
  @Input() componentName: string;
  @Input() ownedObjs: ComponentOwnedObjects;
  @Input() status: ComponentStatusSpec;
}
