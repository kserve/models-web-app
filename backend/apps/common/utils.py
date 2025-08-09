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


def get_raw_deployment_objects(svc, component):
    """
    Get Kubernetes native resources for a RawDeployment InferenceService component.
    
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
