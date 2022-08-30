import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IndexComponent } from './index.component';
import { KubeflowModule } from 'kubeflow';

@NgModule({
  declarations: [IndexComponent],
  imports: [CommonModule, KubeflowModule],
  exports: [],
})
export class IndexModule {}
