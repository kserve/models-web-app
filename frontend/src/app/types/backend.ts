import { BackendResponse, Status, STATUS_TYPE, K8sObject } from 'kubeflow';
import { EventObject } from './event';
import { InferenceServiceK8s } from './kfserving/v1beta1';

export interface MWABackendResponse extends BackendResponse {
  inferenceServices?: InferenceServiceK8s[];
  inferenceService?: InferenceServiceK8s;
  knativeService?: K8sObject;
  knativeConfiguration?: K8sObject;
  knativeRevision?: K8sObject;
  knativeRoute?: K8sObject;
  serviceLogs?: InferenceServiceLogs;
  events?: EventObject[];
  deployment?: K8sObject;
  service?: K8sObject;
  hpa?: K8sObject;
  rawDeploymentObjects?: RawDeploymentObjects;
  modelmeshObjects?: ModelMeshObjects;
}

export interface InferenceServiceLogs {
  predictor?: { podName: string; logs: string[] }[];
  transformer?: { podName: string; logs: string[] }[];
  explainer?: { podName: string; logs: string[] }[];
}

// types presenting the InferenceService dependent k8s objects
export interface InferenceServiceOwnedObjects {
  predictor?: ComponentOwnedObjects;
  transformer?: ComponentOwnedObjects;
  explainer?: ComponentOwnedObjects;
}

export interface ComponentOwnedObjects {
  revision: K8sObject;
  configuration: K8sObject;
  knativeService: K8sObject;
  route: K8sObject;
}

// RawDeployment mode types
export interface RawDeploymentObjects {
  deployment?: K8sObject;
  service?: K8sObject;
  hpa?: K8sObject;
}

export interface RawComponentOwnedObjects {
  deployment?: K8sObject;
  service?: K8sObject;
  hpa?: K8sObject;
}

// ModelMesh mode types
export interface ModelMeshObjects {
  predictor?: any;
  servingRuntime?: K8sObject;
  deployment?: K8sObject;
  service?: K8sObject;
}

export interface ModelMeshComponentOwnedObjects {
  predictor?: any;
  servingRuntime?: K8sObject;
  deployment?: K8sObject;
  service?: K8sObject;
}
