import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageUriComponent } from './storage-uri/storage-uri.component';
import { StorageUriColumnComponent } from './storage-uri-column/storage-uri-column.component';
import { NamespaceSelectModule } from './namespace-select/namespace-select.module';

@NgModule({
  declarations: [StorageUriComponent, StorageUriColumnComponent],
  imports: [CommonModule, NamespaceSelectModule],
  exports: [StorageUriComponent, NamespaceSelectModule],
})
export class SharedModule {}
