declare module 'kubeflow' {
  export enum STATUS_TYPE {
    UNINITIALIZED = 'Uninitialized',
    TERMINATING = 'Terminating',
    WARNING = 'Warning',
    READY = 'Ready',
    UNAVAILABLE = 'Unavailable',
  }

  export enum SnackType {
    Info = 'Info',
    Warning = 'Warning',
    Error = 'Error',
    Success = 'Success',
  }

  export enum DashboardState {
    Disconnected = 'Disconnected',
  }

  export enum DIALOG_RESP {
    ACCEPT = 'ACCEPT',
    REJECT = 'REJECT',
    CANCEL = 'CANCEL',
  }

  export interface ActionEvent {
    action: string;
    data: any;
    event: any;
  }

  export class ToolbarButton {
    constructor(options?: any);
    namespaceChanged(namespace: string | string[], resourceLabel: string): void;
  }

  export interface SnackBarConfig {
    data?: any;
    duration?: number;
    [key: string]: any;
  }

  export class SnackBarService {
    open(config: SnackBarConfig): void;
  }

  export class ConfirmDialogService {
    open(title: string, config?: DialogConfig): any;
  }

  export class NamespaceService {
    dashboardConnected$?: any;
    getSelectedNamespace(): any;
    getSelectedNamespace2(): any;
    updateSelectedNamespace(namespace: string): any;
  }

  export class PollerService {
    exponential<T>(request: any): any;
  }

  export class BackendService {
    constructor(http: any, snack: SnackBarService);
    protected handleError(error: any, showSnack?: boolean): any;
    protected getObjectsAllNamespaces(
      getter: (namespace: string) => any,
      namespaces: string[],
    ): any;
  }

  export class BackendResponse {
    [key: string]: any;
  }

  export class KubeflowModule {
    static ɵmod: any;
    static ɵinj: any;
  }

  export class EditorModule {
    static ɵmod: any;
    static ɵinj: any;
  }

  export class ConditionsTableModule {
    static ɵmod: any;
    static ɵinj: any;
  }

  export class DetailsListModule {
    static ɵmod: any;
    static ɵinj: any;
  }

  export class HeadingSubheadingRowModule {
    static ɵmod: any;
    static ɵinj: any;
  }

  export class ExponentialBackoff {
    constructor(config?: any);
    start(): any;
  }

  export const LinkType: {
    Internal: string;
    External?: string;
    [key: string]: string | undefined;
  };

  export class PropertyValue<T = any> {
    constructor(options?: any);
  }

  export class StatusValue<T = any> {
    constructor(options?: any);
  }

  export class ActionListValue<T = any> {
    constructor(actions?: T[]);
  }

  export class ActionIconValue {
    constructor(options?: any);
  }

  export class DateTimeValue {
    constructor(options?: any);
  }

  export class DateTimeModule {}
  export class PanelModule {}
  export class LoadingSpinnerModule {}
  export class LogsViewerModule {}

  export interface DialogConfig {
    title?: string;
    message?: string;
    accept?: string;
    applying?: string;
    confirmColor?: string;
    cancel?: string;
    [key: string]: any;
  }

  export interface TableConfig {
    dynamicNamespaceColumn?: boolean;
    columns: any[];
    [key: string]: any;
  }

  export class ComponentValue {
    constructor(options?: any);
  }

  export class LinkValue {
    constructor(options?: any);
  }

  export class TableColumnComponent {}

  export interface ListEntry {
    label: string;
    value?: any;
    [key: string]: any;
  }

  export interface ChipDescriptor {
    name: string;
    value?: any;
    [key: string]: any;
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
