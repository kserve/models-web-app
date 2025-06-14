// Mock for Kubeflow imports used in getK8sObjectUiStatus function
export enum STATUS_TYPE {
  UNINITIALIZED = "Uninitialized",
  TERMINATING = "Terminating",
  WARNING = "Warning",
  READY = "Ready",
}

// Interface for Kubernetes condition
export interface Condition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

// Interface for status object
export interface Status {
  phase: STATUS_TYPE;
  state: string;
  message: string;
}

// Interface for Kubernetes object
export interface K8sObject {
  kind: string;
  metadata: {
    name?: string;
    namespace?: string;
    deletionTimestamp?: string;
    [key: string]: any;
  };
  status?: {
    conditions?: Condition[] | null;
    [key: string]: any;
  };
  spec?: any;
}

// Types for getPredictorExtensionSpec tests
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
