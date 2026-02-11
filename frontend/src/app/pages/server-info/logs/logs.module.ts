import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { LogsComponent } from './logs.component';
import {
  KubeflowModule,
  PanelModule,
  LoadingSpinnerModule,
  IconModule,
} from 'kubeflow';
import { LogsViewerModule } from './logs-viewer/logs-viewer.module';

@NgModule({
  declarations: [LogsComponent],
  imports: [
    CommonModule,
    KubeflowModule,
    LogsViewerModule,
    MatTabsModule,
    LoadingSpinnerModule,
    PanelModule,
    IconModule,
  ],
  exports: [LogsComponent],
})
export class LogsModule {}
