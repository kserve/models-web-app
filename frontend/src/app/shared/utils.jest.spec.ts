import {
  getK8sObjectUiStatus,
  getCondition,
  getPredictorExtensionSpec,
  getPredictorRuntime,
} from './utils';
import { STATUS_TYPE, K8sObject } from 'kubeflow';

// Tests for getCondition function
describe('getCondition', () => {
  test('should return Ready condition when it exists and status is True', () => {
    const obj: K8sObject = {
      kind: 'InferenceService',
      metadata: { name: 'test' },
      status: {
        conditions: [
          {
            type: 'PredictorReady',
            status: 'False',
            reason: 'PredictorNotReady',
            message: 'Predictor is not ready',
          },
          {
            type: 'Ready',
            status: 'True',
            reason: 'AllReady',
            message: 'All components are ready',
          },
        ],
      },
    };

    const condition = getCondition(obj);
    expect(condition.type).toBe('Ready');
    expect(condition.status).toBe('True');
    expect(condition.reason).toBe('AllReady');
    expect(condition.message).toBe('All components are ready');
  });

  test('should return first condition with message when no Ready condition with True status exists', () => {
    const obj: K8sObject = {
      kind: 'InferenceService',
      metadata: { name: 'test' },
      status: {
        conditions: [
          {
            type: 'PredictorConfigurationReady',
            status: 'True',
            reason: 'ConfigReady',
            message: 'Predictor configuration is ready',
          },
          {
            type: 'Ready',
            status: 'False',
            reason: 'NotReady',
            message: 'Service is not ready',
          },
        ],
      },
    };

    const condition = getCondition(obj);
    expect(condition.type).toBe('PredictorConfigurationReady');
    expect(condition.message).toBe('Predictor configuration is ready');
  });

  test('should return undefined when no status field exists', () => {
    const obj: K8sObject = {
      kind: 'InferenceService',
      metadata: { name: 'test' },
    };

    const condition = getCondition(obj);
    expect(condition).toBeUndefined();
  });

  test('should return undefined when conditions array is empty', () => {
    const obj: K8sObject = {
      kind: 'InferenceService',
      metadata: { name: 'test' },
      status: {
        conditions: [],
      },
    };

    const condition = getCondition(obj);
    expect(condition).toBeUndefined();
  });

  test('should return undefined when conditions array is null', () => {
    const obj: K8sObject = {
      kind: 'InferenceService',
      metadata: { name: 'test' },
      status: {
        conditions: null,
      },
    };

    const condition = getCondition(obj);
    expect(condition).toBeUndefined();
  });

  test('should sort conditions by priority order and return first with message', () => {
    const obj: K8sObject = {
      kind: 'InferenceService',
      metadata: { name: 'test' },
      status: {
        conditions: [
          {
            type: 'IngressReady',
            status: 'True',
            reason: 'IngressReady',
            message: 'Ingress is ready',
          },
          {
            type: 'PredictorConfigurationReady',
            status: 'False',
            reason: 'ConfigNotReady',
            message: 'Predictor configuration is not ready',
          },
          {
            type: 'TransformerReady',
            status: 'True',
            reason: 'TransformerReady',
            message: 'Transformer is ready',
          },
        ],
      },
    };

    const condition = getCondition(obj);
    // PredictorConfigurationReady has priority 1, should be returned first
    expect(condition.type).toBe('PredictorConfigurationReady');
    expect(condition.message).toBe('Predictor configuration is not ready');
  });
});

// Tests for getK8sObjectUiStatus function
describe('getK8sObjectUiStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return READY status when condition type is Ready and status is True', () => {
    const readyObject: K8sObject = {
      kind: 'InferenceService',
      metadata: {
        name: 'test-service',
      },
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'True',
            reason: 'AllReady',
            message: 'All components are ready.',
          },
        ],
      },
    };

    const status = getK8sObjectUiStatus(readyObject);

    expect(status.phase).toBe(STATUS_TYPE.READY);
    expect(status.message).toBe('InferenceService is Ready.');
  });

  test('should return TERMINATING status when deletionTimestamp is set', () => {
    const terminatingObject: K8sObject = {
      kind: 'Pod',
      metadata: {
        name: 'test-pod',
        deletionTimestamp: new Date('2023-01-01T00:00:00Z'),
      },
    };

    const status = getK8sObjectUiStatus(terminatingObject);

    expect(status.phase).toBe(STATUS_TYPE.TERMINATING);
    expect(status.message).toBe('Pod is being deleted.');
  });

  test('should return WARNING status when status field is not present', () => {
    const noStatusObject: K8sObject = {
      kind: 'Deployment',
      metadata: {
        name: 'test-deployment',
      },
      // no status field
    };

    const status = getK8sObjectUiStatus(noStatusObject);

    expect(status.phase).toBe(STATUS_TYPE.WARNING);
    expect(status.message).toBe(
      "Couldn't find any information for the status. Please take a look at the Events emitted for this Deployment.",
    );
  });

  test('should return WARNING status when no conditions are available', () => {
    const noConditionsObject: K8sObject = {
      kind: 'InferenceService',
      metadata: {
        name: 'test-service-no-conditions',
      },
      status: {
        conditions: [],
      },
    };

    const status = getK8sObjectUiStatus(noConditionsObject);
    expect(status.phase).toBe(STATUS_TYPE.WARNING);
    expect(status.message).toBe("Couldn't find any available condition.");
  });
});

// Tests for getPredictorExtensionSpec function
describe('getPredictorExtensionSpec', () => {
  test('should return model spec when predictor has model', () => {
    const predictor = {
      model: {
        modelFormat: {
          name: 'tensorflow',
          version: '2.6.0',
        },
        runtime: 'tensorflow-serving',
        storageUri: 's3://my-bucket/model',
        runtimeVersion: '2.6.0',
        protocolVersion: 'v1',
      },
      containers: [],
    } as any;

    const result = getPredictorExtensionSpec(predictor);

    expect(result).toBe(predictor.model);
    expect(result.storageUri).toBe('s3://my-bucket/model');
    expect((result as any).runtime).toBe('tensorflow-serving');
  });

  test('should return sklearn spec when predictor has sklearn', () => {
    const predictor = {
      sklearn: {
        storageUri: 's3://my-bucket/sklearn-model',
        runtimeVersion: '0.23.2',
        protocolVersion: 'v1',
      },
      containers: [],
    } as any;

    const result = getPredictorExtensionSpec(predictor);

    expect(result).toBe(predictor.sklearn);
    expect(result.storageUri).toBe('s3://my-bucket/sklearn-model');
  });

  test('should return tensorflow spec when predictor has tensorflow', () => {
    const predictor = {
      tensorflow: {
        storageUri: 's3://my-bucket/tf-model',
        runtimeVersion: '2.6.0',
        protocolVersion: 'v1',
      },
      containers: [],
    } as any;

    const result = getPredictorExtensionSpec(predictor);

    expect(result).toBe(predictor.tensorflow);
    expect(result.storageUri).toBe('s3://my-bucket/tf-model');
  });

  test('should return custom spec from containers when no known predictor type exists', () => {
    const predictor = {
      containers: [
        {
          name: 'custom-predictor',
          image: 'my-custom-image:latest',
          env: [
            { name: 'STORAGE_URI', value: 's3://my-bucket/custom-model' },
            { name: 'MODEL_NAME', value: 'my-model' },
          ],
        },
      ],
    } as any;

    const result = getPredictorExtensionSpec(predictor);

    expect(result.name).toBe('custom-predictor');
    expect(result.image).toBe('my-custom-image:latest');
    expect(result.storageUri).toBe('s3://my-bucket/custom-model');
    expect(result.runtimeVersion).toBe('');
    expect(result.protocolVersion).toBe('');
  });

  test('should handle empty containers array for custom predictor', () => {
    const predictor = {
      containers: [],
    } as any;

    const result = getPredictorExtensionSpec(predictor);

    expect(result.runtimeVersion).toBe('');
    expect(result.protocolVersion).toBe('');
    expect(result.storageUri).toBeUndefined();
  });

  test('should handle missing env variables in custom predictor', () => {
    const predictor = {
      containers: [
        {
          name: 'custom-predictor',
          image: 'my-custom-image:latest',
          // no env
        },
      ],
    } as any;

    const result = getPredictorExtensionSpec(predictor);

    expect(result.name).toBe('custom-predictor');
    expect(result.image).toBe('my-custom-image:latest');
    expect(result.runtimeVersion).toBe('');
    expect(result.protocolVersion).toBe('');
    expect(result.storageUri).toBeUndefined();
  });
});

// Tests for getPredictorRuntime function
describe('getPredictorRuntime', () => {
  test('should return empty string when predictor is null', () => {
    const result = getPredictorRuntime(null as any);
    expect(result).toBe('');
  });

  test('should return custom runtime when model has runtime specified', () => {
    const predictor = {
      model: {
        modelFormat: { name: 'tensorflow' },
        runtime: 'custom-tensorflow-runtime',
        storageUri: 's3://bucket/model',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('custom-tensorflow-runtime');
  });

  test('should return Triton Inference Server for Triton predictor type', () => {
    const predictor = {
      triton: {
        storageUri: 's3://bucket/model',
        runtimeVersion: '2.0',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('Triton Inference Server');
  });

  test('should return Triton Inference Server for Onnx predictor type', () => {
    const predictor = {
      onnx: {
        storageUri: 's3://bucket/model',
        runtimeVersion: '1.0',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('Triton Inference Server');
  });

  test('should return TFServing for Tensorflow predictor type', () => {
    const predictor = {
      tensorflow: {
        storageUri: 's3://bucket/model',
        runtimeVersion: '2.6.0',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('TFServing');
  });

  test('should return TorchServe for Pytorch predictor type', () => {
    const predictor = {
      pytorch: {
        storageUri: 's3://bucket/model',
        runtimeVersion: '1.9',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('TorchServe');
  });

  test('should return SKLearn MLServer for sklearn with v2 protocol', () => {
    const predictor = {
      sklearn: {
        storageUri: 's3://bucket/model',
        protocolVersion: 'v2',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('SKLearn MLServer');
  });

  test('should return SKLearn ModelServer for sklearn without v2 protocol', () => {
    const predictor = {
      sklearn: {
        storageUri: 's3://bucket/model',
        protocolVersion: 'v1',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('SKLearn ModelServer');
  });

  test('should return XGBoost MLServer for xgboost with v2 protocol', () => {
    const predictor = {
      xgboost: {
        storageUri: 's3://bucket/model',
        protocolVersion: 'v2',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('XGBoost MLServer');
  });

  test('should return XGBoost ModelServer for xgboost without v2 protocol', () => {
    const predictor = {
      xgboost: {
        storageUri: 's3://bucket/model',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('XGBoost ModelServer');
  });

  test('should return PMML ModelServer for pmml predictor type', () => {
    const predictor = {
      pmml: {
        storageUri: 's3://bucket/model',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('PMML ModelServer');
  });

  test('should return LightGBM ModelServer for lightgbm predictor type', () => {
    const predictor = {
      lightgbm: {
        storageUri: 's3://bucket/model',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('LightGBM ModelServer');
  });

  test('should return MLFlow ModelServer for mlflow predictor type', () => {
    const predictor = {
      mlflow: {
        storageUri: 's3://bucket/model',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('MLFlow ModelServer');
  });

  test('should return Custom ModelServer for custom predictor type', () => {
    const predictor = {
      containers: [
        {
          name: 'custom-container',
          image: 'custom-image:latest',
        },
      ],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('Custom ModelServer');
  });

  test('should return runtime from model format when model exists', () => {
    const predictor = {
      model: {
        modelFormat: { name: 'sklearn' },
        storageUri: 's3://bucket/model',
      },
      containers: [],
    } as any;

    const result = getPredictorRuntime(predictor);
    expect(result).toBe('SKLearn ModelServer');
  });
});
