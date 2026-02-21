import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { InferenceGraphComponent } from './inference-graph.component';
import { GraphFormComponent } from './graph-form/graph-form.component';
import { GraphInfoComponent } from './graph-info/graph-info.component';
import { KubeflowModule } from 'kubeflow';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    InferenceGraphComponent,
    GraphFormComponent,
    GraphInfoComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    KubeflowModule,
    MatTabsModule,
    SharedModule,
  ],
  exports: [InferenceGraphComponent, GraphFormComponent, GraphInfoComponent],
})
export class InferenceGraphModule {}
