import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubmitFormComponent } from './submit-form.component';
import { KubeflowModule } from 'kubeflow';

@NgModule({
  declarations: [SubmitFormComponent],
  imports: [CommonModule, KubeflowModule],
  exports: [SubmitFormComponent],
})
export class SubmitFormModule {}
