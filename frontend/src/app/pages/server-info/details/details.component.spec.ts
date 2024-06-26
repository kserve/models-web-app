import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {
  DateTimeModule,
  DetailsListModule,
  HeadingSubheadingRowModule,
} from 'kubeflow';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { DetailsComponent } from './details.component';
import { PredictorDetailsComponent } from './predictor/predictor.component';
import { TransformerComponent } from './transformer/transformer.component';
import { ExplainerComponent } from './explainer/explainer.component';
import { ContainerComponent } from './shared/container/container.component';
import { ComponentExtensionComponent } from './shared/component-extension/component-extension.component';
import { PodComponent } from './shared/pod/pod.component';
import { SharedModule } from 'src/app/shared/shared.module';

const mockISVC: InferenceServiceK8s = {
  apiVersion: 'serving.kserve.io/v1beta1',
  kind: 'InferenceService',
  metadata: {
    annotations: {
      'kubectl.kubernetes.io/last-applied-configuration':
        '{"apiVersion":"serving.kserve.io/v1beta1","kind":"InferenceService","metadata":{"annotations":{},"name":"sklearn-iris-2","namespace":"kubeflow-user"},"spec":{"predictor":{"sklearn":{"storageUri":"gs://kfserving-examples/models/sklearn/1.0/model"}}}}\n',
    },
    creationTimestamp: new Date('2022-09-12T10:37:08Z'),
    finalizers: ['inferenceservice.finalizers'],
    generation: 1,
    name: 'sklearn-iris-2',
    namespace: 'kubeflow-user',
    resourceVersion: '49980368',
    selfLink:
      '/apis/serving.kserve.io/v1beta1/namespaces/kubeflow-user/inferenceservices/sklearn-iris-2',
    uid: 'a42b1617-5e0d-4590-bee8-f8dd7002bbb8',
  },
  spec: {
    predictor: {
      containers: [],
      model: {
        modelFormat: {
          name: 'sklearn',
        },
        name: '',
        protocolVersion: 'v1',
        resources: {},
        runtime: 'kserve-sklearnserver',
        storageUri: 'gs://kfserving-examples/models/sklearn/1.0/model',
      },
    },
    transformer: {
      containers: [
        {
          command: ['python3', '-m', 'kale.kfserving'],
          env: [
            {
              name: 'STORAGE_URI',
              value: 'pvc://serving-openvaccine-0-486kc-pvc-prwfw/',
            },
            {
              name: 'PVC_MOUNT_POINT',
              value: '/home/jovyan',
            },
            {
              name: 'KALE_KFSERVING_TRANSFORMER_CLASS',
              value: 'FunctionTransformer',
            },
            {
              name: 'KALE_KFSERVING_TRANSFORMER_PATH',
              value: 'None',
            },
          ],
          image:
            'gcr.io/arrikto/jupyter-kale-py36@sha256:dd3f92ca66b46d247e4b9b6a9d84ffbb368646263c2e3909473c3b851f3fe198',
          name: 'kfserving-container',
          resources: {
            limits: {
              cpu: '1',
              memory: '2Gi',
            },
            requests: {
              cpu: '1',
              memory: '2Gi',
            },
          },
          securityContext: {
            runAsUser: 0,
          },
        },
      ],
    },
    explainer: {
      containers: [],
    },
  },
  status: {
    observedGeneration: 0,
    annotations: {},
    address: {
      url: 'http://sklearn-iris-2.kubeflow-user.svc.cluster.local/v1/models/sklearn-iris-2:predict',
    },
    components: {
      predictor: {
        address: {
          url: 'http://sklearn-iris-2-predictor-default.kubeflow-user.svc.cluster.local',
        },
        latestCreatedRevision: 'sklearn-iris-2-predictor-default-00001',
        latestReadyRevision: 'sklearn-iris-2-predictor-default-00001',
        latestRolledoutRevision: 'sklearn-iris-2-predictor-default-00001',
        url: 'http://sklearn-iris-2-predictor-default.kubeflow-user.example.com',
      },
    },
    conditions: [
      {
        lastTransitionTime: '2022-09-12T10:37:31Z',
        status: 'True',
        type: 'IngressReady',
      },
      {
        lastTransitionTime: '2022-09-12T10:37:27Z',
        status: 'True',
        type: 'PredictorConfigurationReady',
      },
      {
        lastTransitionTime: '2022-09-12T10:37:30Z',
        status: 'True',
        type: 'PredictorReady',
      },
      {
        lastTransitionTime: '2022-09-12T10:37:30Z',
        status: 'True',
        type: 'PredictorRouteReady',
      },
      {
        lastTransitionTime: '2022-09-12T10:37:31Z',
        status: 'True',
        type: 'Ready',
      },
    ],
    url: 'http://sklearn-iris-2.kubeflow-user.example.com',
  },
};

describe('DetailsComponent', () => {
  let component: DetailsComponent;
  let fixture: ComponentFixture<DetailsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [
        DetailsComponent,
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
        SharedModule,
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DetailsComponent);
    component = fixture.componentInstance;
    component.svc = mockISVC;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
