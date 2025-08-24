"""Common utils for parsing and handling InferenceServices."""
import os

from kubeflow.kubeflow.crud_backend import api, helpers, logging
from . import versions

log = logging.getLogger(__name__)

KNATIVE_REVISION_LABEL = "serving.knative.dev/revision"
FILE_ABS_PATH = os.path.abspath(os.path.dirname(__file__))

INFERENCESERVICE_TEMPLATE_YAML = os.path.join(
    FILE_ABS_PATH, "yaml", "inference_service_template.yaml")


def load_inference_service_template(**kwargs):
    """
    Return an InferenceService dict, with defaults from the local yaml.

    Reads the yaml for the web app's custom resource, replaces the variables
    and returns it as a python dict.

    kwargs: the parameters to be replaced in the yaml
    """
    return helpers.load_param_yaml(INFERENCESERVICE_TEMPLATE_YAML, **kwargs)

# helper functions for accessing the logs of an InferenceService in raw
# kubernetes mode


def get_raw_inference_service_pods(svc, components=[]):
    """
    Return a dictionary with (endpoint, component) keys
    i.e. ("default", "predictor") and a list of pod names as values
    """
    namespace = svc["metadata"]["namespace"]
    svc_name = svc["metadata"]["name"]
    label_selector = "serving.kubeflow.org/inferenceservice={}".format(
        svc_name)
    pods = api.v1_core.list_namespaced_pod(
        namespace, label_selector=label_selector).items
    component_pods_dict = {}
    for pod in pods:
        component = pod.metadata.labels.get("component", "")
        if component not in components:
            continue

        curr_pod_names = component_pods_dict.get(component, [])
        curr_pod_names.append(pod.metadata.name)
        component_pods_dict[component] = curr_pod_names

    if len(component_pods_dict.keys()) == 0:
        log.info("No pods are found for inference service: %s",
                 svc["metadata"]["name"])

    return component_pods_dict

# helper functions for accessing the logs of an InferenceService


def get_inference_service_pods(svc, components=[]):
    """
    Return the Pod names for the different isvc components.

    Return a dictionary with (endpoint, component) keys,
    i.e. ("default", "predictor") and a list of pod names as values
    """
    namespace = svc["metadata"]["namespace"]

    # dictionary{revisionName: (endpoint, component)}
    revisions_dict = get_components_revisions_dict(components, svc)

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
            curr_pod_names = component_pods_dict.get(component, [])
            curr_pod_names.append(pod.metadata.name)
            component_pods_dict[component] = curr_pod_names

    if len(component_pods_dict.keys()) == 0:
        log.info("No pods are found for inference service: %s",
                 svc["metadata"]["name"])

    return component_pods_dict


def get_modelmesh_pods(svc, components=[]):
    """
    Return a dictionary with component keys and ModelMesh pod names as values.

    For ModelMesh deployments, logs are typically found in the
    modelmesh-serving pods.
    """
    namespace = svc["metadata"]["namespace"]

    # ModelMesh uses its own deployment for serving
    label_selector = "app=modelmesh-serving"
    pods = api.v1_core.list_namespaced_pod(
        namespace, label_selector=label_selector).items

    component_pods_dict = {}

    # For ModelMesh, we map all requested components to modelmesh-serving pods
    for component in components:
        pod_names = []
        for pod in pods:
            pod_names.append(pod.metadata.name)

        if pod_names:
            component_pods_dict[component] = pod_names

    if len(component_pods_dict.keys()) == 0:
        log.info("No ModelMesh pods found for inference service: %s",
                 svc["metadata"]["name"])

    return component_pods_dict


# FIXME(elikatsis,kimwnasptd): Change the logic of this function according to
# https://github.com/arrikto/dev/issues/867
def get_components_revisions_dict(components, svc):
    """Return a dictionary{revisionId: component}."""
    status = svc["status"]
    revisions_dict = {}

    for component in components:
        if "components" not in status:
            log.info("Component '%s' not in inference service '%s'",
                     component, svc["metadata"]["name"])
            continue

        if component not in status["components"]:
            log.info("Component '%s' not in inference service '%s'",
                     component, svc["metadata"]["name"])
            continue

        if "latestReadyRevision" in status["components"][component]:
            revision = status["components"][component]["latestReadyRevision"]

            revisions_dict[revision] = component

    if len(revisions_dict.keys()) == 0:
        log.info(
            "No revisions found for the inference service's components: %s",
            svc["metadata"]["name"],
        )

    return revisions_dict


def is_raw_deployment(svc):
    """
    Check if an InferenceService is using RawDeployment mode.

    Returns True if the service uses RawDeployment, False for Serverless mode.
    """
    annotations = svc.get("metadata", {}).get("annotations", {})

    # Check for the new KServe annotation
    deployment_mode = annotations.get("serving.kserve.io/deploymentMode", "")
    if deployment_mode.lower() == "rawdeployment":
        return True

    # Check for legacy annotation (backward compatibility)
    raw_mode = annotations.get("serving.kubeflow.org/raw", "false")
    if raw_mode.lower() == "true":
        return True

    return False


def is_modelmesh_deployment(svc):
    """
    Check if an InferenceService is using ModelMesh mode.

    Returns True if the service uses ModelMesh deployment mode.
    """
    annotations = svc.get("metadata", {}).get("annotations", {})
    deployment_mode = annotations.get("serving.kserve.io/deploymentMode", "")
    return deployment_mode.lower() == "modelmesh"


def get_deployment_mode(svc):
    """
    Get the deployment mode of an InferenceService.

    Returns one of: "ModelMesh", "RawDeployment", "Serverless"
    """
    if is_modelmesh_deployment(svc):
        return "ModelMesh"
    elif is_raw_deployment(svc):
        return "RawDeployment"
    else:
        return "Serverless"


def get_raw_deployment_objects(svc, component):
    """
    Get Kubernetes native resources for a RawDeployment InferenceService
    component.

    Returns a dictionary with deployment, service, and hpa objects.
    """
    namespace = svc["metadata"]["namespace"]
    svc_name = svc["metadata"]["name"]

    # RawDeployment resources follow naming convention: {isvc-name}-{component}
    resource_name = f"{svc_name}-{component}"

    objects = {
        "deployment": None,
        "service": None,
        "hpa": None,
    }

    try:
        # Get Deployment
        deployment = api.get_custom_rsrc(
            **versions.K8S_DEPLOYMENT,
            namespace=namespace,
            name=resource_name
        )
        objects["deployment"] = deployment
        log.info(f"Found deployment {resource_name} for component {component}")
    except Exception as e:
        log.warning(f"Could not find deployment {resource_name}: {e}")

    try:
        # Get Service
        service = api.get_custom_rsrc(
            **versions.K8S_SERVICE,
            namespace=namespace,
            name=resource_name
        )
        objects["service"] = service
        log.info(f"Found service {resource_name} for component {component}")
    except Exception as e:
        log.warning(f"Could not find service {resource_name}: {e}")

    try:
        # Get HPA (optional)
        hpa = api.get_custom_rsrc(
            **versions.K8S_HPA,
            namespace=namespace,
            name=resource_name
        )
        objects["hpa"] = hpa
        log.info(f"Found HPA {resource_name} for component {component}")
    except Exception as e:
        log.debug(f"No HPA found for {resource_name}: {e}")

    return objects


def get_modelmesh_objects(svc, component):
    """
    Get ModelMesh-specific resources for an InferenceService component.

    ModelMesh uses different resource patterns than standard KServe.
    Returns a dictionary with predictor-related objects.
    """
    namespace = svc["metadata"]["namespace"]

    objects = {
        "predictor": None,
        "servingRuntime": None,
        "deployment": None,
        "service": None,
    }

    try:
        # In ModelMesh, the actual serving is handled by the
        # ModelMesh controller
        # Look for the predictor status information
        if "status" in svc and "components" in svc["status"]:
            if component in svc["status"]["components"]:
                objects["predictor"] = svc["status"]["components"][component]
                log.info(f"Found ModelMesh predictor status for "
                         f"component {component}")

        # Try to find the associated ServingRuntime
        serving_runtime_name = None
        if "spec" in svc and component in svc["spec"]:
            runtime_ref = svc["spec"][component].get("runtime")
            if runtime_ref:
                serving_runtime_name = runtime_ref
            else:
                # Fallback: infer from model format
                model_format = (svc["spec"][component]
                                .get("model", {})
                                .get("modelFormat", {})
                                .get("name"))
                if model_format:
                    serving_runtime_name = f"mlserver-{model_format.lower()}"

        if serving_runtime_name:
            try:
                # Get ServingRuntime
                serving_runtime = api.get_custom_rsrc(
                    group="serving.kserve.io",
                    version="v1alpha1",
                    kind="servingruntimes",
                    namespace=namespace,
                    name=serving_runtime_name
                )
                objects["servingRuntime"] = serving_runtime
                log.info(f"Found ServingRuntime {serving_runtime_name} for "
                         f"component {component}")
            except Exception as e:
                log.warning(f"Could not find ServingRuntime "
                            f"{serving_runtime_name}: {e}")

        # Try to find ModelMesh deployment (usually named modelmesh-serving)
        try:
            modelmesh_deployment = api.get_custom_rsrc(
                **versions.K8S_DEPLOYMENT,
                namespace=namespace,
                name="modelmesh-serving"
            )
            objects["deployment"] = modelmesh_deployment
            log.info(f"Found ModelMesh deployment for "
                     f"component {component}")
        except Exception as e:
            log.debug(f"No ModelMesh deployment found: {e}")

        # Try to find ModelMesh service
        try:
            modelmesh_service = api.get_custom_rsrc(
                **versions.K8S_SERVICE,
                namespace=namespace,
                name="modelmesh-serving"
            )
            objects["service"] = modelmesh_service
            log.info(f"Found ModelMesh service for component {component}")
        except Exception as e:
            log.debug(f"No ModelMesh service found: {e}")

    except Exception as e:
        log.error(f"Error fetching ModelMesh objects for {component}: {e}")

    return objects
