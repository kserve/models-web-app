import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IndexComponent } from './index.component';
import { KubeflowModule } from 'kubeflow';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [IndexComponent],
  imports: [CommonModule, KubeflowModule, SharedModule],
  exports: [],
})
export class IndexModule {}
