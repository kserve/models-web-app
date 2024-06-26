import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ConditionsTableModule,
  DetailsListModule,
  HeadingSubheadingRowModule,
  KubeflowModule,
} from 'kubeflow';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { ComponentOverviewComponent } from './component/component.component';

import { OverviewComponent } from './overview.component';

describe('OverviewComponent', () => {
  let component: OverviewComponent;
  let fixture: ComponentFixture<OverviewComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [OverviewComponent, ComponentOverviewComponent],
      imports: [
        CommonModule,
        MatDividerModule,
        MatTooltipModule,
        MatIconModule,
        KubeflowModule,
        DetailsListModule,
        ConditionsTableModule,
        HeadingSubheadingRowModule,
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OverviewComponent);
    component = fixture.componentInstance;
    component.svc = {
      spec: {
        predictor: {
          sklearn: {
            storageUri: '',
            runtimeVersion: '',
            protocolVersion: '',
          },
        },
      },
    } as InferenceServiceK8s;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
