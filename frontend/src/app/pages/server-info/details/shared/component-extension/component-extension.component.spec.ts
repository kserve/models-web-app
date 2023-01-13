import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ComponentExtensionComponent } from './component-extension.component';

describe('ComponentExtensionComponent', () => {
  let component: ComponentExtensionComponent;
  let fixture: ComponentFixture<ComponentExtensionComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ComponentExtensionComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ComponentExtensionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
