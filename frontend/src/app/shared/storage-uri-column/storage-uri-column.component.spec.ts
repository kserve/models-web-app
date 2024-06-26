import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StorageUriColumnComponent } from './storage-uri-column.component';

describe('StorageUriColumnComponent', () => {
  let component: StorageUriColumnComponent;
  let fixture: ComponentFixture<StorageUriColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StorageUriColumnComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StorageUriColumnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
