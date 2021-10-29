import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { LogsComponent } from './logs.component';
import {
  KubeflowModule,
  PanelModule,
  LoadingSpinnerModule,
  LogsViewerModule,
} from 'kubeflow';

@NgModule({
  declarations: [LogsComponent],
  imports: [
    CommonModule,
    KubeflowModule,
    LogsViewerModule,
    MatTabsModule,
    LoadingSpinnerModule,
    PanelModule,
  ],
  exports: [LogsComponent],
})
export class LogsModule {}
