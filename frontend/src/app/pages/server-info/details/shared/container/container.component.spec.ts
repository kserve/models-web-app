import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { V1Container, V1EnvVar } from '@kubernetes/client-node';
import { DetailsListModule } from 'kubeflow';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { ContainerComponent } from './container.component';

describe('ContainerComponent', () => {
  let component: ContainerComponent;
  let fixture: ComponentFixture<ContainerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ContainerComponent],
      imports: [CommonModule, DetailsListModule, MatSnackBarModule],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ContainerComponent);
    component = fixture.componentInstance;
    component.container = {
      command: [],
      env: [] as V1EnvVar[],
    } as V1Container;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
