/// <reference types="jest" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NamespaceService, SnackBarService } from 'kubeflow';
import { of, throwError } from 'rxjs';
import { SubmitFormComponent } from './submit-form.component';
import { MWABackendService } from 'src/app/services/backend.service';

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

const MULTI_DOC_YAML = `${INFERENCE_SERVICE_YAML}\n---\n${TRAINED_MODEL_YAML}`;

describe('SubmitFormComponent', () => {
  let component: SubmitFormComponent;
  let fixture: ComponentFixture<SubmitFormComponent>;
  let mockBackend: jest.Mocked<Partial<MWABackendService>>;
  let mockSnack: { open: jest.Mock };
  let mockRouter: { navigate: jest.Mock };

  beforeEach(async () => {
    mockBackend = {
      postInferenceService: jest.fn().mockReturnValue(of({})),
      postTrainedModel: jest.fn().mockReturnValue(of({})),
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
          useValue: { getSelectedNamespace: () => of('test-ns') },
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

  it('should create and bind namespace from NamespaceService', () => {
    expect(component).toBeTruthy();
    expect(component.namespace).toBe('test-ns');
  });

  describe('single-document YAML (backward compatibility)', () => {
    it('should call postInferenceService once and navigate back on success', done => {
      component.yaml = INFERENCE_SERVICE_YAML;

      component.submit();

      setTimeout(() => {
        expect(mockBackend.postInferenceService).toHaveBeenCalledTimes(1);
        expect(mockBackend.postTrainedModel).not.toHaveBeenCalled();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['']);
        done();
      }, 100);
    });

    it('should show "InferenceService created successfully." for single-doc', done => {
      component.yaml = INFERENCE_SERVICE_YAML;

      component.submit();

      setTimeout(() => {
        const msg = mockSnack.open.mock.calls[0][0].data.msg;
        expect(msg).toBe('InferenceService created successfully.');
        done();
      }, 100);
    });
  });

  describe('multi-document YAML', () => {
    it('should call postInferenceService and postTrainedModel for each document', done => {
      component.yaml = MULTI_DOC_YAML;

      component.submit();

      setTimeout(() => {
        expect(mockBackend.postInferenceService).toHaveBeenCalledTimes(1);
        expect(mockBackend.postTrainedModel).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).toHaveBeenCalledWith(['']);
        done();
      }, 100);
    });

    it('should show "N resources created successfully." for multi-doc', done => {
      component.yaml = MULTI_DOC_YAML;

      component.submit();

      setTimeout(() => {
        const msg = mockSnack.open.mock.calls[0][0].data.msg;
        expect(msg).toBe('2 resources created successfully.');
        done();
      }, 100);
    });

    it('should inject the current namespace into every document before POSTing', done => {
      component.namespace = 'production';
      component.yaml = MULTI_DOC_YAML;

      component.submit();

      setTimeout(() => {
        const svc = (mockBackend.postInferenceService as jest.Mock).mock
          .calls[0][0];
        expect(svc.metadata.namespace).toBe('production');

        const tm = (mockBackend.postTrainedModel as jest.Mock).mock.calls[0][0];
        expect(tm.metadata.namespace).toBe('production');
        done();
      }, 100);
    });

    it('should call postTrainedModel for each TrainedModel document', done => {
      const twoTrainedModels = `${INFERENCE_SERVICE_YAML}
---
${TRAINED_MODEL_YAML}
---
apiVersion: serving.kserve.io/v1alpha1
kind: TrainedModel
metadata:
  name: simple-string
spec:
  inferenceService: triton-mms
  model:
    framework: tensorflow
    storageUri: gs://kfserving-examples/models/triton/simple_string
    memory: 1Gi`;

      component.yaml = twoTrainedModels;

      component.submit();

      setTimeout(() => {
        expect(mockBackend.postInferenceService).toHaveBeenCalledTimes(1);
        expect(mockBackend.postTrainedModel).toHaveBeenCalledTimes(2);
        expect(mockRouter.navigate).toHaveBeenCalledWith(['']);
        done();
      }, 100);
    });
  });

  describe('YAML parsing errors', () => {
    it('should show a snackbar error and not call any API for malformed YAML', () => {
      component.yaml = 'invalid: yaml: [[[unclosed';

      component.submit();

      expect(mockSnack.open).toHaveBeenCalled();
      const snackConfig = mockSnack.open.mock.calls[0][0];
      expect(snackConfig.data.msg).toMatch(/yaml parsing error/i);
      expect(mockBackend.postInferenceService).not.toHaveBeenCalled();
      expect(component.applying).toBe(false);
    });

    it('should show an error for empty YAML', () => {
      component.yaml = '';

      component.submit();

      expect(mockSnack.open).toHaveBeenCalled();
      expect(mockBackend.postInferenceService).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should require at least one InferenceService document', () => {
      component.yaml = TRAINED_MODEL_YAML;

      component.submit();

      expect(mockSnack.open).toHaveBeenCalled();
      const msg = mockSnack.open.mock.calls[0][0].data.msg;
      expect(msg).toContain(
        'At least one InferenceService document is required',
      );
      expect(mockBackend.postInferenceService).not.toHaveBeenCalled();
    });

    it('should reject more than one InferenceService in a single submission', () => {
      component.yaml = `${INFERENCE_SERVICE_YAML}\n---\n${INFERENCE_SERVICE_YAML}`;

      component.submit();

      expect(mockSnack.open).toHaveBeenCalled();
      const msg = mockSnack.open.mock.calls[0][0].data.msg;
      expect(msg).toContain('Only one InferenceService document is allowed');
      expect(mockBackend.postInferenceService).not.toHaveBeenCalled();
    });

    it('should reject unsupported resource kinds', () => {
      component.yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
spec:
  replicas: 1`;

      component.submit();

      expect(mockSnack.open).toHaveBeenCalled();
      const msg = mockSnack.open.mock.calls[0][0].data.msg;
      expect(msg).toContain('Unsupported resource kind');
      expect(mockBackend.postInferenceService).not.toHaveBeenCalled();
    });

    it('should validate InferenceService missing spec.predictor', () => {
      component.yaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: no-predictor
spec: {}`;

      component.submit();

      expect(mockSnack.open).toHaveBeenCalled();
      const msg = mockSnack.open.mock.calls[0][0].data.msg;
      expect(msg).toContain('spec.predictor');
      expect(mockBackend.postInferenceService).not.toHaveBeenCalled();
    });

    it('should validate TrainedModel missing spec.inferenceService', () => {
      component.yaml = `${INFERENCE_SERVICE_YAML}
---
apiVersion: serving.kserve.io/v1alpha1
kind: TrainedModel
metadata:
  name: bad-model
spec:
  model:
    framework: pytorch
    storageUri: gs://example/model
    memory: 1Gi`;

      component.submit();

      expect(mockSnack.open).toHaveBeenCalled();
      const msg = mockSnack.open.mock.calls[0][0].data.msg;
      expect(msg).toContain('spec.inferenceService');
      expect(mockBackend.postInferenceService).not.toHaveBeenCalled();
    });
  });

  describe('backend error handling', () => {
    it('should show snackbar error and not navigate when backend returns an error', done => {
      mockBackend.postInferenceService = jest
        .fn()
        .mockReturnValue(
          throwError(() => ({ error: { log: 'Cluster error' } })),
        );

      component.yaml = INFERENCE_SERVICE_YAML;

      component.submit();

      setTimeout(() => {
        expect(mockSnack.open).toHaveBeenCalled();
        const msg = mockSnack.open.mock.calls[0][0].data.msg;
        expect(msg).toBe('Cluster error');
        expect(mockRouter.navigate).not.toHaveBeenCalled();
        expect(component.applying).toBe(false);
        done();
      }, 100);
    });
  });
});
