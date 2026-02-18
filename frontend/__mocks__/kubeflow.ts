// Mock for Kubeflow imports used in getK8sObjectUiStatus function
export enum STATUS_TYPE {
  UNINITIALIZED = 'Uninitialized',
  TERMINATING = 'Terminating',
  WARNING = 'Warning',
  READY = 'Ready',
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

// Base BackendService class mock
export class BackendService {
  constructor(public http?: any, public snack?: any) {}

  handleError(error: any): any {
    return error;
  }
}

// NamespaceService mock
export class NamespaceService {
  getSelectedNamespace() {
    return null;
  }
  updateSelectedNamespace(ns: string) {}
}

// ConfirmDialogService mock
export class ConfirmDialogService {
  open() {
    return null;
  }
}

// SnackBarService mock
export class SnackBarService {
  open() {}
}

// SnackType enum
export enum SnackType {
  Error = 'error',
  Warning = 'warning',
  Success = 'success',
  Info = 'info',
}

// SnackBarConfig
export interface SnackBarConfig {
  data: {
    msg: string;
    snackType: SnackType;
  };
  duration?: number;
}

// DIALOG_RESP enum
export enum DIALOG_RESP {
  ACCEPT = 'accept',
  CANCEL = 'cancel',
}

// PollerService mock
export class PollerService {
  exponential() {
    return null;
  }
}

// ToolbarButton class
export class ToolbarButton {
  text: string;
  icon: string;
  stroked?: boolean;
  fn?: () => void;

  constructor(config: any) {
    this.text = config.text || '';
    this.icon = config.icon || '';
    this.stroked = config.stroked;
    this.fn = config.fn;
  }

  namespaceChanged(ns: string, resource: string) {}
}

// ActionEvent interface
export interface ActionEvent {
  action: string;
  data: any;
  event?: any;
}

// DashboardState enum
export enum DashboardState {
  Connected = 'connected',
  Disconnected = 'disconnected',
}

// ExponentialBackoff class
export class ExponentialBackoff {
  constructor(config: any) {}

  start() {
    return { subscribe: () => {} };
  }
}

// StatusValue class for table columns
export class StatusValue {
  field: string;

  constructor(config: any) {
    this.field = config.field || '';
  }
}

// LinkType enum
export enum LinkType {
  Internal = 'internal',
  External = 'external',
}

// LinkValue class for table columns
export class LinkValue {
  field: string;
  popoverField?: string;
  truncate?: boolean;
  linkType?: LinkType;

  constructor(config: any) {
    this.field = config.field || '';
    this.popoverField = config.popoverField;
    this.truncate = config.truncate;
    this.linkType = config.linkType;
  }
}

// PropertyValue class for table columns
export class PropertyValue {
  field: string;

  constructor(config: any) {
    this.field = config.field || '';
  }
}

// DateTimeValue class for table columns
export class DateTimeValue {
  field: string;

  constructor(config: any) {
    this.field = config.field || '';
  }
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
