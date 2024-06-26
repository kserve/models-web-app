import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ComponentExtensionSpec } from 'src/app/types/kfserving/v1beta1';

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
    component.ext = {} as ComponentExtensionSpec;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
