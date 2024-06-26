import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ExplainerSpec } from 'src/app/types/kfserving/v1beta1';

import { ExplainerComponent } from './explainer.component';

describe('ExplainerComponent', () => {
  let component: ExplainerComponent;
  let fixture: ComponentFixture<ExplainerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ExplainerComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ExplainerComponent);
    component = fixture.componentInstance;
    component.explainerSpec = {} as ExplainerSpec;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
