import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PodComponent } from './pod.component';

describe('PodComponent', () => {
  let component: PodComponent;
  let fixture: ComponentFixture<PodComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [PodComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PodComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
