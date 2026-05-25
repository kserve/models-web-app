/// <reference types="jest" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DashboardState, NamespaceService, SnackBarService } from 'kubeflow';
import { of, throwError } from 'rxjs';
import { SubmitFormComponent } from './submit-form.component';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';

const INFERENCE_SERVICE_YAML = `
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: triton-mms
spec:
  predictor:
    model:
      modelFormat:
        name: triton
`.trim();

const TRAINED_MODEL_YAML = `
apiVersion: serving.kserve.io/v1alpha1
kind: TrainedModel
metadata:
  name: cifar10
spec:
  inferenceService: triton-mms
  model:
    framework: pytorch
    storageUri: gs://kfserving-examples/models/torchscript/cifar10
    memory: 1Gi
`.trim();

const INFERENCE_GRAPH_YAML = `
apiVersion: serving.kserve.io/v1alpha1
kind: InferenceGraph
metadata:
  name: routing-graph
spec:
  nodes:
    root:
      routerType: Sequence
      steps:
        - serviceName: triton-mms
`.trim();

const MULTI_DOC_YAML = `${INFERENCE_SERVICE_YAML}
---
${TRAINED_MODEL_YAML}`;

describe('SubmitFormComponent', () => {
  let component: SubmitFormComponent;
  let fixture: ComponentFixture<SubmitFormComponent>;
  let mockBackend: jest.Mocked<Partial<MWABackendService>>;
  let mockSnack: { open: jest.Mock };
  let mockRouter: { navigate: jest.Mock };

  const expectNoCreateRequest = () => {
    expect(mockBackend.postKServeResources).not.toHaveBeenCalled();
  };

  beforeEach(async () => {
    mockBackend = {
      postKServeResources: jest.fn().mockReturnValue(of({})),
    };
    mockSnack = { open: jest.fn() };
    mockRouter = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      declarations: [SubmitFormComponent],
      imports: [RouterTestingModule],
      providers: [
        { provide: MWABackendService, useValue: mockBackend },
        {
          provide: NamespaceService,
          useValue: {
            dashboardConnected$: of(DashboardState.Disconnected),
            getSelectedNamespace: jest.fn().mockReturnValue(of('dashboard-ns')),
          },
        },
        {
          provide: MWANamespaceService,
          useValue: {
            initialize: jest.fn().mockReturnValue(of('test-ns')),
            getSelectedNamespace: jest.fn().mockReturnValue(of('test-ns')),
          },
        },
        { provide: SnackBarService, useValue: mockSnack },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and bind namespace from MWANamespaceService', () => {
    expect(component).toBeTruthy();
    expect(component.namespace).toBe('test-ns');
  });

  it('should submit single-document YAML through the batch endpoint', () => {
    component.yaml = INFERENCE_SERVICE_YAML;

    component.submit();

    expect(mockBackend.postKServeResources).toHaveBeenCalledTimes(1);
    const [namespace, resources] =
      mockBackend.postKServeResources.mock.calls[0];
    expect(namespace).toBe('test-ns');
    expect(resources.length).toBe(1);
    expect(resources[0].kind).toBe('InferenceService');
    expect(resources[0].metadata.namespace).toBe('test-ns');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['']);
  });

  it('should show a single-resource success message', () => {
    component.yaml = INFERENCE_SERVICE_YAML;

    component.submit();

    const msg = mockSnack.open.mock.calls[0][0].data.msg;
    expect(msg).toBe('1 KServe resource created successfully.');
  });

  it('should preserve multi-document order and namespace all resources', () => {
    component.namespace = 'production';
    component.yaml = `${INFERENCE_SERVICE_YAML}
---
${TRAINED_MODEL_YAML}
---
${INFERENCE_GRAPH_YAML}`;

    component.submit();

    const [namespace, resources] =
      mockBackend.postKServeResources.mock.calls[0];
    expect(namespace).toBe('production');
    expect(resources.map(resource => resource.kind)).toEqual([
      'InferenceService',
      'TrainedModel',
      'InferenceGraph',
    ]);
    expect(
      resources.every(resource => resource.metadata.namespace === 'production'),
    ).toBe(true);
  });

  it('should allow more than one InferenceService document', () => {
    component.yaml = `${INFERENCE_SERVICE_YAML}
---
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: second-model
spec:
  predictor:
    model:
      modelFormat:
        name: sklearn`;

    component.submit();

    const [, resources] = mockBackend.postKServeResources.mock.calls[0];
    expect(resources.length).toBe(2);
    expect(
      resources.every(resource => resource.kind === 'InferenceService'),
    ).toBe(true);
  });

  it('should accept InferenceGraph documents', () => {
    component.yaml = INFERENCE_GRAPH_YAML;

    component.submit();

    const [, resources] = mockBackend.postKServeResources.mock.calls[0];
    expect(resources.length).toBe(1);
    expect(resources[0].kind).toBe('InferenceGraph');
  });

  it('should show a snackbar error and not call any API for malformed YAML', () => {
    component.yaml = 'invalid: yaml: [[[unclosed';

    component.submit();

    const snackConfig = mockSnack.open.mock.calls[0][0];
    expect(snackConfig.data.msg).toMatch(/yaml parsing error/i);
    expectNoCreateRequest();
    expect(component.applying).toBe(false);
  });

  it('should show an error for empty YAML', () => {
    component.yaml = '';

    component.submit();

    expect(mockSnack.open.mock.calls[0][0].data.msg).toContain('YAML is empty');
    expectNoCreateRequest();
  });

  it('should reject scalar YAML documents', () => {
    component.yaml = 'hello';

    component.submit();

    expect(mockSnack.open.mock.calls[0][0].data.msg).toContain(
      'resource must be an object',
    );
    expectNoCreateRequest();
  });

  it('should reject unsupported resource kinds', () => {
    component.yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
spec:
  replicas: 1`;

    component.submit();

    expect(mockSnack.open.mock.calls[0][0].data.msg).toContain(
      'unsupported resource',
    );
    expectNoCreateRequest();
  });

  it('should preserve original document numbers when skipping empty documents', () => {
    component.yaml = `---
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
spec:
  replicas: 1`;

    component.submit();

    expect(mockSnack.open.mock.calls[0][0].data.msg).toContain(
      'Document 2: unsupported resource',
    );
    expectNoCreateRequest();
  });

  it('should validate generic required fields before submitting', () => {
    component.yaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata: {}
spec: {}`;

    component.submit();

    expect(mockSnack.open.mock.calls[0][0].data.msg).toContain('metadata.name');
    expectNoCreateRequest();
  });

  it('should validate missing spec before submitting', () => {
    component.yaml = `apiVersion: serving.kserve.io/v1alpha1
kind: TrainedModel
metadata:
  name: bad-model`;

    component.submit();

    expect(mockSnack.open.mock.calls[0][0].data.msg).toContain(
      'missing required field spec',
    );
    expectNoCreateRequest();
  });

  it('should show backend errors and not navigate', () => {
    mockBackend.postKServeResources = jest
      .fn()
      .mockReturnValue(
        throwError(() => ({ error: { message: 'Cluster error' } })),
      );
    component.yaml = MULTI_DOC_YAML;

    component.submit();

    expect(mockSnack.open.mock.calls[0][0].data.msg).toBe('Cluster error');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component.applying).toBe(false);
  });

  it('should show already-created resources for backend partial failures', () => {
    mockBackend.postKServeResources = jest.fn().mockReturnValue(
      throwError(() => ({
        error: {
          message: 'Failed to create document 2 (TrainedModel/cifar10): denied',
          createdResources: [
            {
              apiVersion: 'serving.kserve.io/v1beta1',
              kind: 'InferenceService',
              name: 'triton-mms',
              namespace: 'test-ns',
            },
          ],
        },
      })),
    );
    component.yaml = MULTI_DOC_YAML;

    component.submit();

    const msg = mockSnack.open.mock.calls[0][0].data.msg;
    expect(msg).toContain(
      'Failed to create document 2 (TrainedModel/cifar10): denied',
    );
    expect(msg).toContain('Already created: InferenceService/triton-mms');
    expect(msg).toContain('test-ns');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component.applying).toBe(false);
  });
});
