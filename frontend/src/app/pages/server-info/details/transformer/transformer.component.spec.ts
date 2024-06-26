import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { V1Container, V1EnvVar } from '@kubernetes/client-node';
import {
  DateTimeModule,
  DetailsListModule,
  HeadingSubheadingRowModule,
} from 'kubeflow';
import { TransformerSpec } from 'src/app/types/kfserving/v1beta1';
import { ExplainerComponent } from '../explainer/explainer.component';
import { ComponentExtensionComponent } from '../shared/component-extension/component-extension.component';
import { ContainerComponent } from '../shared/container/container.component';
import { PodComponent } from '../shared/pod/pod.component';

import { TransformerComponent } from './transformer.component';

describe('TransformerComponent', () => {
  let component: TransformerComponent;
  let fixture: ComponentFixture<TransformerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [
        TransformerComponent,
        ExplainerComponent,
        ContainerComponent,
        ComponentExtensionComponent,
        PodComponent,
      ],
      imports: [
        CommonModule,
        DetailsListModule,
        HeadingSubheadingRowModule,
        DateTimeModule,
        MatSnackBarModule,
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TransformerComponent);
    component = fixture.componentInstance;
    component.transformerSpec = {
      containers: [
        {
          command: [],
          env: [] as V1EnvVar[],
        },
      ] as V1Container[],
    } as TransformerSpec;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
