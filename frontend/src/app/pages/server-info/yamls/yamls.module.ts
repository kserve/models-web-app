import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YamlsComponent } from './yamls.component';
import { EditorModule } from 'kubeflow';

@NgModule({
  declarations: [YamlsComponent],
  imports: [CommonModule, EditorModule],
  exports: [YamlsComponent],
})
export class YamlsModule {}
