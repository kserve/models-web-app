from kubeflow.kubeflow.crud_backend import api, logging

from .. import utils, versions
from . import bp

log = logging.getLogger(__name__)

KSERVE_CONTAINER = "kserve-container"


@bp.route("/api/namespaces/<namespace>/inferenceservices")
def get_inference_services(namespace):
    """Return a list of InferenceService CRs as json objects."""
    gvk = versions.inference_service_gvk()
    inference_services = api.list_custom_rsrc(**gvk, namespace=namespace)

    return api.success_response("inferenceServices",
                                inference_services["items"])


@bp.route("/api/namespaces/<namespace>/inferenceservices/<name>")
def get_inference_service(namespace, name):
    """Return an InferenceService CR as a json object."""
    inference_service = api.get_custom_rsrc(**versions.inference_service_gvk(),
                                            namespace=namespace, name=name)

    return api.success_response("inferenceService", inference_service)


@bp.route("/api/namespaces/<namespace>/inferenceservices/<name>/components/<component>/pods/containers")
def get_inference_service_containers(namespace: str, name: str, component: str):
    """Get all containers and init-containers for the latest pod of the given component.

    The kserve-container will always be the first in the list if it exists

    Return:
        {
            "containers": ["kserve-container", "container2", ...]
        }
    """
    inference_service = api.get_custom_rsrc(**versions.inference_service_gvk(),
                                            namespace=namespace, name=name)

    latest_pod = utils.get_component_latest_pod(inference_service, component)

    if latest_pod is None:
        return api.failed_response(f"couldn't find latest pod for component: {component}", 404)

    containers = []
    for container in latest_pod.spec.init_containers:
        containers.append(container.name)

    for container in latest_pod.spec.containers:
        containers.append(container.name)

    # Make kserve-container always the first container in the list if it exists
    try:
        idx = containers.index(KSERVE_CONTAINER)
        containers.insert(0, containers.pop(idx))
    except ValueError:
        # kserve-container not found in list
        pass

    return api.success_response("containers", containers)


@bp.route("/api/namespaces/<namespace>/inferenceservices/<name>/components/<component>/pods/containers"
          "/<container>/logs")
def get_container_logs(namespace: str, name: str, component: str, container: str):
    """Get logs for a particular container inside the latest pod of the given component

    Logs are split on newline and returned as an array of lines

    Return:
        {
            "logs": ["log\n", "text\n", ...]
        }
    """
    inference_service = api.get_custom_rsrc(**versions.inference_service_gvk(),
                                            namespace=namespace, name=name)
    namespace = inference_service["metadata"]["namespace"]

    latest_pod = utils.get_component_latest_pod(inference_service, component)
    if latest_pod is None:
        return api.failed_response(f"couldn't find latest pod for component: {component}", 404)

    logs = api.get_pod_logs(namespace, latest_pod.metadata.name, container, auth=False)
    logs = logs.split("\n")

    return api.success_response("logs", logs)


@bp.route("/api/namespaces/<namespace>/knativeServices/<name>")
def get_knative_service(namespace, name):
    """Return a Knative Services object as json."""
    svc = api.get_custom_rsrc(**versions.KNATIVE_SERVICE, namespace=namespace,
                              name=name)

    return api.success_response("knativeService", svc)


@bp.route("/api/namespaces/<namespace>/configurations/<name>")
def get_knative_configuration(namespace, name):
    """Return a Knative Configurations object as json."""
    svc = api.get_custom_rsrc(**versions.KNATIVE_CONF, namespace=namespace,
                              name=name)

    return api.success_response("knativeConfiguration", svc)


@bp.route("/api/namespaces/<namespace>/revisions/<name>")
def get_knative_revision(namespace, name):
    """Return a Knative Revision object as json."""
    svc = api.get_custom_rsrc(**versions.KNATIVE_REVISION, namespace=namespace,
                              name=name)

    return api.success_response("knativeRevision", svc)


@bp.route("/api/namespaces/<namespace>/routes/<name>")
def get_knative_route(namespace, name):
    """Return a Knative Route object as json."""
    svc = api.get_custom_rsrc(**versions.KNATIVE_ROUTE, namespace=namespace,
                              name=name)

    return api.success_response("knativeRoute", svc)
