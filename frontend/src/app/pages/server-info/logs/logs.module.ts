import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    LoadingSpinnerModule,
    PanelModule,
  ],
  exports: [LogsComponent],
})
export class LogsModule {}
