import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatTabsModule } from '@angular/material/tabs';
import { LogsViewerComponent } from './logs-viewer.component';
import { HeadingSubheadingRowModule } from 'kubeflow';

@NgModule({
  declarations: [LogsViewerComponent],
  imports: [
    CommonModule,
    MatTabsModule,
    ScrollingModule,
    HeadingSubheadingRowModule,
  ],
  exports: [LogsViewerComponent],
})
export class LogsViewerModule {}
