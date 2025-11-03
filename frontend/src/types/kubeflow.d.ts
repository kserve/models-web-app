declare module 'kubeflow' {
  export enum STATUS_TYPE {
    UNINITIALIZED = 'Uninitialized',
    TERMINATING = 'Terminating',
    WARNING = 'Warning',
    READY = 'Ready',
  }

  export interface Condition {
    type: string;
    status: string;
    reason?: string;
    message?: string;
  }

  export interface Status {
    phase: STATUS_TYPE;
    state: string;
    message: string;
  }

  export interface K8sObject {
    kind?: string;
    metadata?: {
      name?: string;
      namespace?: string;
      deletionTimestamp?: string | Date;
      [key: string]: any;
    };
    status?: {
      conditions?: Condition[] | null;
      [key: string]: any;
    };
    spec?: any;
    [key: string]: any;
  }

  export enum PredictorType {
    Tensorflow = 'tensorflow',
    Triton = 'triton',
    Sklearn = 'sklearn',
    Onnx = 'onnx',
    Pytorch = 'pytorch',
    Xgboost = 'xgboost',
    Pmml = 'pmml',
    Lightgbm = 'lightgbm',
    MLFlow = 'mlflow',
    Custom = 'custom',
  }

  export interface PredictorExtensionSpec {
    storageUri?: string;
    runtimeVersion?: string;
    protocolVersion?: string;
    image?: string;
    name?: string;
    env?: Array<{
      name: string;
      value: string;
    }>;
    [key: string]: any;
  }

  export interface ModelSpec extends PredictorExtensionSpec {
    modelFormat: {
      name: string;
      version?: string;
    };
    runtime?: string;
  }

  export interface PredictorSpec {
    sklearn?: PredictorExtensionSpec;
    xgboost?: PredictorExtensionSpec;
    tensorflow?: PredictorExtensionSpec;
    pytorch?: PredictorExtensionSpec;
    triton?: PredictorExtensionSpec;
    onnx?: PredictorExtensionSpec;
    pmml?: PredictorExtensionSpec;
    lightgbm?: PredictorExtensionSpec;
    mlflow?: PredictorExtensionSpec;
    model?: ModelSpec;
    containers?: Array<{
      name?: string;
      image?: string;
      env?: Array<{
        name: string;
        value: string;
      }>;
      [key: string]: any;
    }>;
    [key: string]: any;
  }
}
