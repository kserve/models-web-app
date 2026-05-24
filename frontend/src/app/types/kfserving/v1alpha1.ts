import { Status, STATUS_TYPE, K8sObject, Condition } from 'kubeflow';
import {
  V1ObjectMeta,
  V1Affinity,
  V1ResourceRequirements,
  V1Toleration,
} from '@kubernetes/client-node';
import { Params } from '@angular/router';

export interface InferenceGraphIR extends InferenceGraphK8s {
  // this type is used in the frontend after parsing the backend response
  ui: {
    actions: {
      delete?: STATUS_TYPE;
    };

    status?: Status;
    routerType?: string;
    nodeCount?: number;
    link?: {
      text: string;
      url: string;
      queryParams?: Params | null;
    };
  };
}

export interface InferenceGraphK8s extends K8sObject {
  metadata?: V1ObjectMeta;
  spec?: InferenceGraphSpec;
  status?: InferenceGraphStatus;
}

/**
 * Spec of InferenceGraph
 */
export interface InferenceGraphSpec {
  // Map of InferenceGraph router nodes
  nodes: { [key: string]: InferenceRouter };
  resources?: V1ResourceRequirements;
  affinity?: V1Affinity;
  timeout?: number;
  routerTimeouts?: InferenceGraphRouterTimeouts;
  minReplicas?: number;
  maxReplicas?: number;
  scaleTarget?: number;
  scaleMetric?: ScaleMetric;
  tolerations?: V1Toleration[];
  nodeSelector?: { [key: string]: string };
  nodeName?: string;
  serviceAccountName?: string;
}

export interface InferenceGraphRouterTimeouts {
  serverRead?: number;
  serverWrite?: number;
  serverIdle?: number;
  serviceClient?: number;
}

export type ScaleMetric = 'cpu' | 'memory' | 'concurrency' | 'rps';

/**
 * Router types for InferenceGraph
 */
export enum InferenceRouterType {
  Sequence = 'Sequence',
  Splitter = 'Splitter',
  Ensemble = 'Ensemble',
  Switch = 'Switch',
}

/**
 * InferenceRouter defines the router for each InferenceGraph node
 */
export interface InferenceRouter {
  routerType: InferenceRouterType;
  steps?: InferenceStep[];
}

/**
 * InferenceStep defines the inference target of the current step
 */
export interface InferenceStep {
  name?: string;
  nodeName?: string;
  serviceName?: string;
  serviceUrl?: string;
  data?: string;
  mapPredictionsToInstances?: boolean;
  weight?: number;
  condition?: string;
  dependency?: InferenceStepDependencyType;
}

export enum InferenceStepDependencyType {
  Soft = 'Soft',
  Hard = 'Hard',
}

/**
 * Status of InferenceGraph
 */
export interface InferenceGraphStatus {
  observedGeneration?: number;
  conditions?: Condition[];
  url?: string;
  deploymentMode?: string;
}

/**
 * Get display status for InferenceGraph
 */
export function getInferenceGraphStatus(
  inferenceGraph: InferenceGraphK8s,
): Status {
  // Check if the InferenceGraph has a creation timestamp (exists in cluster)
  if (!inferenceGraph.metadata?.creationTimestamp) {
    return {
      phase: STATUS_TYPE.UNAVAILABLE,
      state: 'Not Created',
      message: 'InferenceGraph has not been created',
    };
  }

  // If status conditions exist, use them for detailed status
  if (
    inferenceGraph.status?.conditions &&
    inferenceGraph.status.conditions.length > 0
  ) {
    const readyCondition = inferenceGraph.status.conditions.find(
      (c: Condition) => c.type === 'Ready',
    );

    if (readyCondition) {
      if (readyCondition.status === 'True') {
        return {
          phase: STATUS_TYPE.READY,
          state: 'Ready',
          message: readyCondition.message || 'InferenceGraph is ready',
        };
      }

      if (readyCondition.status === 'False') {
        return {
          phase: STATUS_TYPE.UNAVAILABLE,
          state: readyCondition.reason || 'Not Ready',
          message: readyCondition.message || 'InferenceGraph is not ready',
        };
      }
    }

    // If we have conditions but no ready condition, it's still being processed
    return {
      phase: STATUS_TYPE.WAITING,
      state: 'Processing',
      message: 'InferenceGraph is being configured',
    };
  }

  return {
    phase: STATUS_TYPE.WAITING,
    state: 'Initializing',
    message: 'InferenceGraph is initializing',
  };
}

/**
 * Get the root router type for display
 */
export function getRootRouterType(inferenceGraph: InferenceGraphK8s): string {
  if (!inferenceGraph.spec?.nodes || !inferenceGraph.spec.nodes['root']) {
    return 'Unknown';
  }
  return inferenceGraph.spec.nodes['root'].routerType;
}

/**
 * Count the number of nodes in the graph
 */
export function getNodeCount(inferenceGraph: InferenceGraphK8s): number {
  if (!inferenceGraph.spec?.nodes) {
    return 0;
  }
  return Object.keys(inferenceGraph.spec.nodes).length;
}
