"""Common utils for parsing and handling InferenceServices."""

import os

from kubeflow.kubeflow.crud_backend import api, helpers, logging
from . import versions

log = logging.getLogger(__name__)

KNATIVE_REVISION_LABEL = "serving.knative.dev/revision"
ABSOLUTE_FILE_PATH = os.path.abspath(os.path.dirname(__file__))

INFERENCE_SERVICE_TEMPLATE_YAML = os.path.join(
    ABSOLUTE_FILE_PATH, "yaml", "inference_service_template.yaml"
)


def load_inference_service_template(**kwargs):
    """
    Return an InferenceService dict, with defaults from the local yaml.

    Reads the yaml for the web app's custom resource, replaces the variables
    and returns it as a python dict.

    kwargs: the parameters to be replaced in the yaml
    """
    return helpers.load_param_yaml(INFERENCE_SERVICE_TEMPLATE_YAML, **kwargs)


# helper functions for accessing the logs of an InferenceService in raw
# kubernetes mode


def get_raw_inference_service_pods(inference_service, components=[]):
    """
    Return a dictionary with (endpoint, component) keys
    i.e. ("default", "predictor") and a list of pod names as values
    """
    namespace = inference_service["metadata"]["namespace"]
    service_name = inference_service["metadata"]["name"]
    label_selector = "serving.kubeflow.org/inferenceservice={}".format(service_name)
    pods = api.v1_core.list_namespaced_pod(
        namespace, label_selector=label_selector
    ).items
    component_pods_dict = {}
    for pod in pods:
        component = pod.metadata.labels.get("component", "")
        if component not in components:
            continue

        current_pod_names = component_pods_dict.get(component, [])
        current_pod_names.append(pod.metadata.name)
        component_pods_dict[component] = current_pod_names

    if len(component_pods_dict.keys()) == 0:
        log.info(
            "No pods are found for inference service: %s",
            inference_service["metadata"]["name"],
        )

    return component_pods_dict


# helper functions for accessing the logs of an InferenceService


def get_inference_service_pods(inference_service, components=[]):
    """
    Return the Pod names for the different InferenceService components.

    Return a dictionary with (endpoint, component) keys,
    i.e. ("default", "predictor") and a list of pod names as values
    """
    namespace = inference_service["metadata"]["namespace"]

    # dictionary{revisionName: (endpoint, component)}
    revisions_dict = get_components_revisions_dict(components, inference_service)

    if len(revisions_dict.keys()) == 0:
        return {}

    pods = api.list_pods(namespace, auth=False).items
    component_pods_dict = {}
    for pod in pods:
        for revision in revisions_dict:
            if KNATIVE_REVISION_LABEL not in pod.metadata.labels:
                continue

            if pod.metadata.labels[KNATIVE_REVISION_LABEL] != revision:
                continue

            component = revisions_dict[revision]
            current_pod_names = component_pods_dict.get(component, [])
            current_pod_names.append(pod.metadata.name)
            component_pods_dict[component] = current_pod_names

    if len(component_pods_dict.keys()) == 0:
        log.info(
            "No pods are found for inference service: %s",
            inference_service["metadata"]["name"],
        )

    return component_pods_dict


def get_modelmesh_pods(inference_service, components=[]):
    """
    Return a dictionary with component keys and ModelMesh pod names as values.

    For ModelMesh deployments, logs are typically found in the
    ModelMesh controller managed pods.
    """
    namespace = inference_service["metadata"]["namespace"]

    # Use label selector to find ModelMesh pods
    label_selector = "app.kubernetes.io/managed-by=modelmesh-controller"
    pods = api.v1_core.list_namespaced_pod(
        namespace, label_selector=label_selector
    ).items

    component_pods_dict = {}

    # For ModelMesh, we map all requested components to ModelMesh pods
    for component in components:
        pod_names = []
        for pod in pods:
            pod_names.append(pod.metadata.name)

        if pod_names:
            component_pods_dict[component] = pod_names

    if len(component_pods_dict.keys()) == 0:
        log.info(
            "No ModelMesh pods found for inference service: %s",
            inference_service["metadata"]["name"],
        )

    return component_pods_dict


# FIXME(elikatsis,kimwnasptd): Change the logic of this function according to
# https://github.com/arrikto/dev/issues/867
def get_components_revisions_dict(components, inference_service):
    """Return a dictionary{revisionId: component}."""
    status = inference_service["status"]
    revisions_dict = {}

    for component in components:
        if "components" not in status:
            log.info(
                "Component '%s' not in inference service '%s'",
                component,
                inference_service["metadata"]["name"],
            )
            continue

        if component not in status["components"]:
            log.info(
                "Component '%s' not in inference service '%s'",
                component,
                inference_service["metadata"]["name"],
            )
            continue

        if "latestReadyRevision" in status["components"][component]:
            revision = status["components"][component]["latestReadyRevision"]

            revisions_dict[revision] = component

    if len(revisions_dict.keys()) == 0:
        log.info(
            "No revisions found for the inference service's components: %s",
            inference_service["metadata"]["name"],
        )

    return revisions_dict


def is_raw_deployment(inference_service):
    """
    Check if an InferenceService is using RawDeployment mode.

    Returns True if the service uses RawDeployment, False for Serverless mode.
    """
    annotations = inference_service.get("metadata", {}).get("annotations", {})

    # Check for the new KServe annotation
    deployment_mode = annotations.get("serving.kserve.io/deploymentMode", "")
    if deployment_mode.lower() == "rawdeployment":
        return True

    # Check for legacy annotation (backward compatibility)
    raw_mode = annotations.get("serving.kubeflow.org/raw", "false")
    if raw_mode.lower() == "true":
        return True

    return False


def is_modelmesh_deployment(inference_service):
    """
    Check if an InferenceService is using ModelMesh mode.

    Returns True if the service uses ModelMesh deployment mode.
    """
    annotations = inference_service.get("metadata", {}).get("annotations", {})
    deployment_mode = annotations.get("serving.kserve.io/deploymentMode", "")
    return deployment_mode.lower() == "modelmesh"


def get_deployment_mode(inference_service):
    """
    Get the deployment mode of an InferenceService.

    Returns one of: "ModelMesh", "RawDeployment", "Serverless"
    """
    if is_modelmesh_deployment(inference_service):
        return "ModelMesh"
    elif is_raw_deployment(inference_service):
        return "RawDeployment"
    else:
        return "Serverless"


def get_raw_deployment_objects(inference_service, component):
    """
    Get Kubernetes native resources for a RawDeployment InferenceService
    component.

    Returns a dictionary with deployment, service, and HorizontalPodAutoscaler
    (HPA) objects.
    """
    namespace = inference_service["metadata"]["namespace"]
    service_name = inference_service["metadata"]["name"]

    # RawDeployment resources follow naming convention: {inference-service-name}-{component}
    resource_name = f"{service_name}-{component}"

    objects = {
        "deployment": None,
        "service": None,
        "hpa": None,
    }

    try:
        # Get Deployment
        deployment = api.get_custom_rsrc(
            **versions.KUBERNETES_DEPLOYMENT_RESOURCE,
            namespace=namespace,
            name=resource_name,
        )
        objects["deployment"] = deployment
        log.info(f"Found deployment {resource_name} for component {component}")
    except Exception as e:
        log.warning(f"Could not find deployment {resource_name}: {e}")

    try:
        # Get Service
        service = api.get_custom_rsrc(
            **versions.KUBERNETES_SERVICE_RESOURCE,
            namespace=namespace,
            name=resource_name,
        )
        objects["service"] = service
        log.info(f"Found service {resource_name} for component {component}")
    except Exception as e:
        log.warning(f"Could not find service {resource_name}: {e}")

    try:
        # Get HorizontalPodAutoscaler (optional)
        horizontal_pod_autoscaler = api.get_custom_rsrc(
            **versions.KUBERNETES_HPA_RESOURCE,
            namespace=namespace,
            name=resource_name,
        )
        objects["hpa"] = horizontal_pod_autoscaler
        log.info(
            f"Found HorizontalPodAutoscaler {resource_name} for component {component}"
        )
    except Exception as e:
        log.debug(
            f"No HorizontalPodAutoscaler found for {resource_name}: {e}"
        )

    return objects


def get_modelmesh_objects(inference_service, component):
    """
    Get ModelMesh-specific resources for an InferenceService component.
    """
    namespace = inference_service["metadata"]["namespace"]
    objects = {
        "predictor": None,
        "servingRuntime": None,
        "deployment": None,
        "service": None,
    }

    # 1. Get predictor status
    if "status" in inference_service and "components" in inference_service.get("status", {}):
        objects["predictor"] = inference_service["status"]["components"].get(component)

    # 2. Determine the ServingRuntime name (early exit if not found)
    runtime_name = _extract_serving_runtime_name(inference_service, component)
    if not runtime_name:
        log.warning(f"Could not determine ServingRuntime for component {component}")
        return objects

    # 3. Get the ServingRuntime object
    objects["servingRuntime"] = _get_kubernetes_object(
        namespace=namespace,
        name=runtime_name,
        group="serving.kserve.io",
        version="v1alpha1",
        kind="servingruntimes",
    )

    # 4. Determine the resource name using the standard convention
    # Pattern: {serviceName}-{runtimeName}
    service_name = _get_modelmesh_service_name()
    resource_name = f"{service_name}-{runtime_name}"
    log.info(f"Constructed ModelMesh resource name: {resource_name}")

    # 5. Get the Deployment and Service by their specific names
    objects["deployment"] = _get_kubernetes_object(
        namespace=namespace,
        name=resource_name,
        **versions.KUBERNETES_DEPLOYMENT_RESOURCE,
    )
    objects["service"] = _get_kubernetes_object(
        namespace=namespace,
        name=resource_name,
        **versions.KUBERNETES_SERVICE_RESOURCE,
    )

    return objects


def _extract_serving_runtime_name(inference_service, component):
    """Extract the ServingRuntime name from an InferenceService spec."""
    component_spec = inference_service.get("spec", {}).get(component, {})
    if not component_spec:
        return None

    # Check for explicit runtime reference
    if runtime_ref := component_spec.get("runtime"):
        return runtime_ref

    return None


def _get_modelmesh_service_name():
    """Uses ModelMesh default service name."""
    default_name = "modelmesh-serving"
    return default_name


def _get_kubernetes_object(namespace, name, group, version, kind):
    """A generic helper to get any single Kubernetes resource by its name."""
    try:
        resource = api.get_custom_rsrc(
            group=group,
            version=version,
            kind=kind,
            namespace=namespace,
            name=name,
        )
        log.info(f"Found {kind.rstrip('s')} '{name}' in namespace '{namespace}'")
        return resource
    except Exception as e:
        log.debug(f"Could not find {kind.rstrip('s')} '{name}': {e}")
        return None
