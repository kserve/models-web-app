import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ComponentStatusSpec } from 'src/app/types/kfserving/v1beta1';
import { ComponentOwnedObjects } from 'src/app/types/backend';

@Component({
  standalone: false,
  selector: 'app-serving-component-overview',
  templateUrl: './component.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./component.component.scss'],
})
export class ComponentOverviewComponent {
  @Input() componentName: string;
  @Input() ownedObjs: ComponentOwnedObjects;
  @Input() status: ComponentStatusSpec;
}
