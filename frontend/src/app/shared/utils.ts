import { Condition, Status, STATUS_TYPE, K8sObject } from 'kubeflow';
import { V1Container } from '@kubernetes/client-node';
import {
  InferenceServiceK8s,
  PredictorSpec,
  PredictorType,
  PredictorExtensionSpec,
  ExplainerSpec,
} from '../types/kfserving/v1beta1';

/*
 * general util functions
 */
export function dictIsEmpty(obj: any): boolean {
  return Object.keys(obj).length === 0;
}

/*
 * kfserving helpers
 */
export function svcHasComponent(
  inferenceService: InferenceServiceK8s,
  component: string,
): boolean {
  return !!inferenceService.spec[component];
}

export function getSvcComponents(
  inferenceService: InferenceServiceK8s,
): string[] {
  const components: string[] = [];

  ['predictor', 'transformer', 'explainer'].forEach(c => {
    if (!svcHasComponent(inferenceService, c)) {
      return;
    }

    components.push(c);
  });

  return components;
}

// functions for setting the status of an InferenceService
export function getCondition(obj: K8sObject): Condition {
  let cs: Condition[] = [];

  // The order list based on Condition's types
  const order = {
    PredictorConfigurationReady: 1,
    TransformerConfigurationReady: 2,
    ExplainerConfigurationReady: 3,
    PredictorRouteReady: 4,
    TransformerRouteReady: 5,
    ExplainerRoutesReady: 6,
    PredictorReady: 7,
    TransformerReady: 8,
    ExplainerReady: 9,
    IngressReady: 10,
  };

  try {
    cs = obj.status.conditions;
  } catch (err) {
    return undefined;
  }

  if (!cs) {
    return undefined;
  }

  // Check for a Ready condition
  for (const c of cs) {
    if (c.type === 'Ready' && c.status === 'True') {
      return c;
    }
  }

  // Sort the conditions based on their type
  cs.sort(function (a, b) {
    return order[a.type] - order[b.type];
  });

  // Return the first condition of the sorted list with a message
  for (const c of cs) {
    if (c.message) {
      return c;
    }
  }
}

export function getK8sObjectUiStatus(obj: K8sObject): Status {
  const status: Status = {
    phase: STATUS_TYPE.UNINITIALIZED,
    state: '',
    message: '',
  };

  if (obj.metadata.deletionTimestamp) {
    status.phase = STATUS_TYPE.TERMINATING;
    status.message = `${obj.kind} is being deleted.`;
    return status;
  }

  if (!obj.status) {
    status.phase = STATUS_TYPE.WARNING;
    status.message = `Couldn't find any information for the status. Please take a look at the Events emitted for this ${obj.kind}.`;
    return status;
  }

  const condition = getCondition(obj);
  if (condition === undefined) {
    status.phase = STATUS_TYPE.WARNING;
    status.message = `Couldn't find any available condition.`;
    return status;
  }

  if (condition.type === 'Ready') {
    status.phase = STATUS_TYPE.READY;
    status.message = `${obj.kind} is Ready.`;
    return status;
  }

  status.phase = STATUS_TYPE.WARNING;
  status.message = condition.reason + ': ' + condition.message;
  return status;
}

// functions for processing the InferenceService spec
export function getPredictorType(predictor: PredictorSpec): PredictorType {
  if (predictor.model) {
    return predictor.model?.modelFormat.name as PredictorType;
  } else {
    for (const predictorType of Object.values(PredictorType)) {
      if (predictorType in predictor) {
        return predictorType;
      }
    }

    return PredictorType.Custom;
  }
}

export function getPredictorExtensionSpec(
  predictor: PredictorSpec,
): PredictorExtensionSpec {
  if (predictor.model) {
    return predictor.model;
  } else {
    for (const predictorType of Object.values(PredictorType)) {
      if (predictorType in predictor) {
        return predictor[predictorType];
      }
    }
  }

  // In the case of Custom predictors, set the additional PredictorExtensionSpec fields
  // manually here
  const spec = (predictor?.containers?.[0] || {}) as PredictorExtensionSpec;
  spec.runtimeVersion = '';
  spec.protocolVersion = '';

  if (spec?.env) {
    const storageUri = spec.env.find(
      envVar => envVar.name.toLowerCase() === 'storage_uri',
    );
    if (storageUri) {
      spec.storageUri = storageUri.value;
    }
  }

  return spec;
}

export function getExplainerContainer(explainer: ExplainerSpec): V1Container {
  if ('alibi' in explainer) {
    return explainer.alibi;
  }

  if ('aix' in explainer) {
    return explainer.aix;
  }

  return null;
}

export function parseRuntime(inferenceService: InferenceServiceK8s): string {
  return getPredictorRuntime(inferenceService.spec.predictor);
}

export function getPredictorRuntime(predictor: PredictorSpec): string {
  if (predictor === null) {
    return '';
  }

  if (predictor?.model?.runtime) {
    return predictor.model.runtime;
  }

  const predictorType = getPredictorType(predictor);

  if (
    predictorType === PredictorType.Triton ||
    predictorType === PredictorType.Onnx
  ) {
    return 'Triton Inference Server';
  }
  if (predictorType === PredictorType.Tensorflow) {
    return 'TFServing';
  }
  if (predictorType === PredictorType.Pytorch) {
    return 'TorchServe';
  }
  if (predictorType === PredictorType.Sklearn) {
    if (predictor.sklearn?.protocolVersion === 'v2') {
      return 'SKLearn MLServer';
    }
    return 'SKLearn ModelServer';
  }
  if (predictorType === PredictorType.Xgboost) {
    if (predictor.xgboost?.protocolVersion === 'v2') {
      return 'XGBoost MLServer';
    }
    return 'XGBoost ModelServer';
  }
  if (predictorType === PredictorType.Pmml) {
    return 'PMML ModelServer';
  }
  if (predictorType === PredictorType.Lightgbm) {
    return 'LightGBM ModelServer';
  }
  if (predictorType === PredictorType.MLFlow) {
    return 'MLFlow ModelServer';
  }
  if (predictorType === PredictorType.Huggingface) {
    return 'HuggingFace ModelServer';
  }
  if (predictorType === PredictorType.Custom) {
    return 'Custom ModelServer';
  }
}
