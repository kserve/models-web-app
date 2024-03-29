import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverviewComponent } from './overview.component';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import {
  KubeflowModule,
  ConditionsTableModule,
  DetailsListModule,
  HeadingSubheadingRowModule,
} from 'kubeflow';
import { ComponentOverviewComponent } from './component/component.component';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [OverviewComponent, ComponentOverviewComponent],
  imports: [
    CommonModule,
    MatDividerModule,
    MatTooltipModule,
    MatIconModule,
    KubeflowModule,
    DetailsListModule,
    ConditionsTableModule,
    HeadingSubheadingRowModule,
    SharedModule,
  ],
  exports: [OverviewComponent],
})
export class OverviewModule {}
