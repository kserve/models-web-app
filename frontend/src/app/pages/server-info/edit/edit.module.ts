import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KubeflowModule } from 'kubeflow';

import { EditComponent } from './edit.component';
import { AceEditorModule } from '@derekbaker/ngx-ace-editor-wrapper';


@NgModule({
  declarations: [EditComponent],
  imports: [CommonModule, AceEditorModule, KubeflowModule],
  exports: [EditComponent],
})
export class EditModule {}
