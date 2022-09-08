import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageUriComponent } from './storage-uri/storage-uri.component';
import { StorageUriColumnComponent } from './storage-uri-column/storage-uri-column.component';

@NgModule({
  declarations: [StorageUriComponent, StorageUriColumnComponent],
  imports: [CommonModule],
  exports: [StorageUriComponent],
})
export class SharedModule {}
