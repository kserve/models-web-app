import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KubeflowModule } from 'kubeflow';
import { EditComponent } from './edit.component';
import { AceModule } from 'ngx-ace-wrapper';
import { ACE_CONFIG } from 'ngx-ace-wrapper';
import { AceConfigInterface } from 'ngx-ace-wrapper';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

const DEFAULT_ACE_CONFIG: AceConfigInterface = {
  tabSize: 2,
  enableBasicAutocompletion: true,
  enableLiveAutocompletion: true,
  enableSnippets: true,
  wrap: true,
  autoScrollEditorIntoView: true,
};

@NgModule({
  declarations: [EditComponent],
  imports: [
    CommonModule,
    AceModule,
    KubeflowModule,
    MatDividerModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  providers: [
    {
      provide: ACE_CONFIG,
      useValue: DEFAULT_ACE_CONFIG,
    },
  ],
  exports: [EditComponent],
})
export class EditModule {}
