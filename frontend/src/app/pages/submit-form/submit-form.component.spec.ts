import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SubmitFormComponent } from './submit-form.component';

describe('SubmitFormComponent', () => {
  let component: SubmitFormComponent;
  let fixture: ComponentFixture<SubmitFormComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SubmitFormComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
