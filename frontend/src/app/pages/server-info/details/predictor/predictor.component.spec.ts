import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {
  DateTimeModule,
  DetailsListModule,
  HeadingSubheadingRowModule,
} from 'kubeflow';
import { PredictorSpec } from 'src/app/types/kfserving/v1beta1';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { PredictorDetailsComponent } from './predictor.component';
import { TransformerComponent } from '../transformer/transformer.component';
import { ExplainerComponent } from '../explainer/explainer.component';
import { ContainerComponent } from '../shared/container/container.component';
import { ComponentExtensionComponent } from '../shared/component-extension/component-extension.component';
import { PodComponent } from '../shared/pod/pod.component';
import { V1EnvVar } from '@kubernetes/client-node';

describe('PredictorDetailsComponent', () => {
  let component: PredictorDetailsComponent;
  let fixture: ComponentFixture<PredictorDetailsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [
        PredictorDetailsComponent,
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
    fixture = TestBed.createComponent(PredictorDetailsComponent);
    component = fixture.componentInstance;
    component.predictorSpec = {
      sklearn: {
        command: [],
        env: [] as V1EnvVar[],
        storageUri: '',
        runtimeVersion: '',
        protocolVersion: '',
      },
    } as PredictorSpec;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
