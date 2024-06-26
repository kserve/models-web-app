import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { V1PodSpec } from '@kubernetes/client-node';

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
    component.pod = {} as V1PodSpec;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
