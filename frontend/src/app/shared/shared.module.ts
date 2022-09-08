import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageUriComponent } from './storage-uri/storage-uri.component';

@NgModule({
  declarations: [StorageUriComponent],
  imports: [CommonModule],
  exports: [StorageUriComponent],
})
export class SharedModule {}
