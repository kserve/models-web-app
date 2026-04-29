import { throwError, of, Observable, Subject } from 'rxjs';
import { NgModule } from '@angular/core';

export enum STATUS_TYPE {
  UNINITIALIZED = 'Uninitialized',
  TERMINATING = 'Terminating',
  WARNING = 'Warning',
  READY = 'Ready',
  UNAVAILABLE = 'Unavailable',
  WAITING = 'Waiting',
  ERROR = 'Error',
}

// Interface for Kubernetes condition
export interface Condition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
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
  apiVersion?: string;
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

  handleError(error: any, showSnackBar: boolean = true): any {
    return throwError(() => error);
  }

  getObjectsAllNamespaces(url: string, namespaces?: string[]): Observable<any> {
    return of([]);
  }
}

// NamespaceService mock
export class NamespaceService {
  dashboardConnected$ = of(DashboardState.Connected);
  
  getSelectedNamespace() {
    return of('kubeflow-user');
  }
  
  getSelectedNamespace2() {
    return of('kubeflow-user');
  }
  
  updateSelectedNamespace(ns: string) {}
}

// ConfirmDialogService mock
export class ConfirmDialogService {
  open(title: string, config: any) {
    return {
      componentInstance: {
        applying$: new Subject<boolean>(),
      },
      afterClosed: () => of(DIALOG_RESP.ACCEPT),
      close: (result?: any) => {},
    };
  }
}

// SnackBarService mock
export class SnackBarService {
  open(config: SnackBarConfig) {}
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

// ListEntry interface for details list
export interface ListEntry {
  name: string;
  value: any;
}

// ChipDescriptor interface
export interface ChipDescriptor {
  value: string;
  color?: string;
  tooltip?: string;
}

// DIALOG_RESP enum
export enum DIALOG_RESP {
  ACCEPT = 'accept',
  CANCEL = 'cancel',
}

// DialogConfig interface
export interface DialogConfig {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  cancel?: string;
  accept?: string;
  applying?: string;
  confirmColor?: string;
  width?: string;
  data?: any;
  error?: any;
}

// PollerService mock
export class PollerService {
  exponential(request?: any) {
    const backoff = new ExponentialBackoff({});
    // Return an observable that has the backoff methods
    const obs: any = of(null);
    obs.start = () => of(null);
    obs.reset = () => {};
    return obs;
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
    return of(null);
  }

  reset() {
    // Mock reset method
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

// TableConfig interface
export interface TableConfig {
  columns: any[];
  data?: any[];
  dynamicNamespaceColumn?: boolean;
  sortByColumn?: string;
  sortDirection?: string;
}

// TableColumn interface
export interface TableColumn {
  matHeaderCellDef: string;
  matColumnDef: string;
  value?: any;
  textAlignment?: string;
  sort?: boolean;
}

// ComponentValue class for table columns
export class ComponentValue {
  component: any;

  constructor(config: any) {
    this.component = config.component;
  }
}

// ActionListValue class for table columns
export class ActionListValue {
  constructor(config: any) {}
}

// ActionIconValue class for table columns
export class ActionIconValue {
  constructor(config: any) {}
}

// TableColumnComponent for storage-uri-column
export interface TableColumnComponent {
  element?: any;
  data?: any;
}

// Provide a base implementation that components can extend
export abstract class BaseTableColumnComponent implements TableColumnComponent {
  element?: any;
  data?: any;
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

// Mock Angular modules
@NgModule({})
export class KubeflowModule {}

@NgModule({})
export class ResourceTableModule {}

@NgModule({})
export class DetailsListModule {}

@NgModule({})
export class EditorModule {}

@NgModule({})
export class PanelModule {}

@NgModule({})
export class LoadingSpinnerModule {}

@NgModule({})
export class HeadingSubheadingRowModule {}

@NgModule({})
export class DateTimeModule {}

@NgModule({})
export class ConditionsTableModule {}
