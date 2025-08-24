"""GET request handlers."""
from flask import request

from kubeflow.kubeflow.crud_backend import api, logging

from .. import utils, versions
from . import bp

log = logging.getLogger(__name__)


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
    inference_service = api.get_custom_rsrc(
        **versions.inference_service_gvk(),
        namespace=namespace, name=name)
    if request.args.get("logs", "false") == "true":
        # find the logs
        return api.success_response(
            "serviceLogs", get_inference_service_logs(inference_service),
        )

    # deployment mode information to the response
    deployment_mode = utils.get_deployment_mode(inference_service)
    inference_service["deploymentMode"] = deployment_mode

    return api.success_response("inferenceService", inference_service)


def get_inference_service_logs(svc):
    """Return all logs for all isvc component pods."""
    namespace = svc["metadata"]["namespace"]
    components = request.args.getlist("component")

    log.info(components)

    # Check deployment mode to determine how to get logs
    deployment_mode = utils.get_deployment_mode(svc)

    if deployment_mode == "ModelMesh":
        # For ModelMesh, get logs from modelmesh-serving deployment
        component_pods_dict = utils.get_modelmesh_pods(svc, components)
    elif deployment_mode == "RawDeployment":
        component_pods_dict = utils.get_raw_inference_service_pods(
            svc, components)
    else:
        # Serverless mode
        component_pods_dict = utils.get_inference_service_pods(svc, components)

    if len(component_pods_dict.keys()) == 0:
        return {}

    resp = {}
    logging.info("Component pods: %s", component_pods_dict)
    for component, pods in component_pods_dict.items():
        if component not in resp:
            resp[component] = []

        for pod in pods:
            logs = api.get_pod_logs(namespace, pod, "kserve-container",
                                    auth=False)
            resp[component].append({"podName": pod,
                                    "logs": logs.split("\n")})
    return resp


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


@bp.route("/api/namespaces/<namespace>/inferenceservices/<name>/events")
def get_inference_service_events(namespace, name):

    field_selector = api.events_field_selector("InferenceService", name)

    events = api.events.list_events(namespace, field_selector).items

    return api.success_response(
        "events", api.serialize(events),
    )


# RawDeployment mode endpoints
@bp.route("/api/namespaces/<namespace>/deployments/<name>")
def get_kubernetes_deployment(namespace, name):
    """Return a Kubernetes Deployment object as json."""
    deployment = api.get_custom_rsrc(**versions.K8S_DEPLOYMENT,
                                     namespace=namespace, name=name)
    return api.success_response("deployment", deployment)


@bp.route("/api/namespaces/<namespace>/services/<name>")
def get_kubernetes_service(namespace, name):
    """Return a Kubernetes Service object as json."""
    service = api.get_custom_rsrc(**versions.K8S_SERVICE,
                                  namespace=namespace, name=name)
    return api.success_response("service", service)


@bp.route("/api/namespaces/<namespace>/hpas/<name>")
def get_kubernetes_hpa(namespace, name):
    """Return a Kubernetes HPA object as json."""
    hpa = api.get_custom_rsrc(**versions.K8S_HPA,
                              namespace=namespace, name=name)
    return api.success_response("hpa", hpa)


@bp.route("/api/namespaces/<namespace>/inferenceservices/<name>/"
          "rawdeployment/<component>")
def get_raw_deployment_objects(namespace, name, component):
    """Return all Kubernetes native resources for a RawDeployment component."""

    inference_service = api.get_custom_rsrc(
        **versions.inference_service_gvk(),
        namespace=namespace, name=name)

    if not utils.is_raw_deployment(inference_service):
        return api.error_response(
            "InferenceService is not in RawDeployment mode", 400)

    objects = utils.get_raw_deployment_objects(inference_service, component)
    return api.success_response("rawDeploymentObjects", objects)


@bp.route("/api/namespaces/<namespace>/inferenceservices/<name>/"
          "modelmesh/<component>")
def get_modelmesh_objects(namespace, name, component):
    """Return all ModelMesh-specific resources for a ModelMesh component."""

    inference_service = api.get_custom_rsrc(
        **versions.inference_service_gvk(),
        namespace=namespace, name=name)

    if not utils.is_modelmesh_deployment(inference_service):
        return api.error_response(
            "InferenceService is not in ModelMesh mode", 400)

    objects = utils.get_modelmesh_objects(inference_service, component)
    return api.success_response("modelmeshObjects", objects)
