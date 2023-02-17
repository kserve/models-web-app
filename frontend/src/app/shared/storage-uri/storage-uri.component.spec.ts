import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StorageUriComponent } from './storage-uri.component';

describe('StorageUriComponent', () => {
  let component: StorageUriComponent;
  let fixture: ComponentFixture<StorageUriComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StorageUriComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StorageUriComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
