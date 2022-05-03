import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PredictorDetailsComponent } from './predictor.component';

describe('PredictorDetailsComponent', () => {
  let component: PredictorDetailsComponent;
  let fixture: ComponentFixture<PredictorDetailsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PredictorDetailsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PredictorDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
