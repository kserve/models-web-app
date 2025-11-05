import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { StorageUriComponent } from './storage-uri/storage-uri.component';
import { StorageUriColumnComponent } from './storage-uri-column/storage-uri-column.component';
import { NamespaceSelectComponent } from './namespace-select/namespace-select.component';

@NgModule({
  declarations: [
    StorageUriComponent,
    StorageUriColumnComponent,
    NamespaceSelectComponent,
  ],
  imports: [CommonModule, MatSelectModule, MatFormFieldModule, MatIconModule],
  exports: [StorageUriComponent, NamespaceSelectComponent],
})
export class SharedModule {}
