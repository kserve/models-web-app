"""Common utils for parsing and handling InferenceServices."""
import os
from typing import Dict, Union

from kubeflow.kubeflow.crud_backend import api, helpers, logging

log = logging.getLogger(__name__)

KNATIVE_REVISION_LABEL = "serving.knative.dev/revision"
LATEST_CREATED_REVISION = "latestCreatedRevision"
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


def get_component_latest_pod(svc: Dict,
                             component: str) -> Union[api.client.V1Pod, None]:
    """Get pod of the latest Knative revision for the given component.

    Return:
        Latest pod: k8s V1Pod
    """
    namespace = svc["metadata"]["namespace"]

    latest_revision = get_component_latest_revision(svc, component)

    if latest_revision is None:
        return None

    pods = api.list_pods(namespace, auth=False).items

    for pod in pods:
        if KNATIVE_REVISION_LABEL not in pod.metadata.labels:
            continue

        if pod.metadata.labels[KNATIVE_REVISION_LABEL] != latest_revision:
            continue

        return pod

    log.info(
        f"No pods are found for inference service: {svc['metadata']['name']}")

    return None


def get_component_latest_revision(svc: Dict,
                                  component: str) -> Union[str, None]:
    """Get the name of the latest created knative revision for the given component.

    Return:
        Latest Created Knative Revision: str
    """
    status = svc["status"]

    if "components" not in status:
        log.info(f"Components field not found in status object of {svc['metadata']['name']}")  # noqa: E501
        return None

    if component not in status["components"]:
        log.info(f"Component {component} not found in inference service {svc['metadata']['name']}")  # noqa: E501
        return None

    if LATEST_CREATED_REVISION in status["components"][component]:
        return status["components"][component][LATEST_CREATED_REVISION]

    log.info(f"No {LATEST_CREATED_REVISION} found for the {component} in {svc['metadata']['name']}")  # noqa: E501

    return None
