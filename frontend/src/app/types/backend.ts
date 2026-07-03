import { BackendResponse, Status, STATUS_TYPE, K8sObject } from 'kubeflow';
import { EventObject } from './event';
import { InferenceServiceK8s } from './kfserving/v1beta1';
import { InferenceGraphK8s } from './kfserving/v1alpha1';

export interface MWABackendResponse extends BackendResponse {
  inferenceServices?: InferenceServiceK8s[];
  inferenceService?: InferenceServiceK8s;
  inferenceGraphs?: InferenceGraphK8s[];
  inferenceGraph?: InferenceGraphK8s;
  createdResources?: KServeResourceIdentity[];
  failedDocumentIndex?: number;
  failedResource?: KServeResourceIdentity;
  knativeService?: K8sObject;
  knativeConfiguration?: K8sObject;
  knativeRevision?: K8sObject;
  knativeRoute?: K8sObject;
  serviceLogs?: InferenceServiceLogs;
  events?: EventObject[];
  deployment?: K8sObject;
  service?: K8sObject;
  hpa?: K8sObject;
  standardDeploymentObjects?: StandardDeploymentObjects;
  modelmeshObjects?: ModelMeshObjects;
  logs?: string[];
  containers?: string[];
}

export interface KServeResourceIdentity {
  apiVersion?: string;
  kind?: string;
  name?: string;
  namespace?: string;
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
  revision?: K8sObject | null;
  configuration?: K8sObject | null;
  knativeService?: K8sObject | null;
  route?: K8sObject | null;
  deployment?: K8sObject | null;
  service?: K8sObject | null;
  hpa?: K8sObject | null;
  predictor?: any;
  servingRuntime?: K8sObject | null;
}

// Standard mode types
export interface StandardDeploymentObjects {
  deployment?: K8sObject | null;
  service?: K8sObject | null;
  hpa?: K8sObject | null;
}

export interface RawComponentOwnedObjects {
  deployment?: K8sObject | null;
  service?: K8sObject | null;
  hpa?: K8sObject | null;
}

// ModelMesh mode types
export interface ModelMeshObjects {
  predictor?: any;
  servingRuntime?: K8sObject | null;
  deployment?: K8sObject | null;
  service?: K8sObject | null;
}

export interface ModelMeshComponentOwnedObjects {
  predictor?: any;
  servingRuntime?: K8sObject | null;
  deployment?: K8sObject | null;
  service?: K8sObject | null;
}
