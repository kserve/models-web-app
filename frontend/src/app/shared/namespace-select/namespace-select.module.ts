import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KubeflowModule } from 'kubeflow';
import { NamespaceSelectComponent } from './namespace-select.component';

@NgModule({
  declarations: [NamespaceSelectComponent],
  imports: [CommonModule, KubeflowModule],
  exports: [NamespaceSelectComponent],
})
export class NamespaceSelectModule {}
