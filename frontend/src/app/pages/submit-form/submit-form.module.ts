import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { SubmitFormComponent } from './submit-form.component';
import { EditorModule, KubeflowModule } from 'kubeflow';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

@NgModule({
  declarations: [SubmitFormComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    EditorModule,
    KubeflowModule,
  ],
  exports: [SubmitFormComponent],
})
export class SubmitFormModule {}
