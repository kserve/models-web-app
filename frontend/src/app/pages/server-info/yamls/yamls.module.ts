import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YamlsComponent } from './yamls.component';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';

@NgModule({
  declarations: [YamlsComponent],
  imports: [CommonModule, AceEditorModule],
  exports: [YamlsComponent],
})
export class YamlsModule {}
