"""GET request handlers."""

from flask import request

from kubeflow.kubeflow.crud_backend import api, logging

from .. import utils, versions
from . import bp

log = logging.getLogger(__name__)


@bp.route("/api/namespaces/<namespace>/inferenceservices")
def get_inference_services(namespace):
    """Return a list of InferenceService custom resources as JSON objects."""
    group_version_kind = versions.inference_service_group_version_kind()
    inference_services = api.list_custom_rsrc(
        **group_version_kind, namespace=namespace
    )

    return api.success_response("inferenceServices", inference_services["items"])


@bp.route("/api/namespaces/<namespace>/inferenceservices/<name>")
def get_inference_service(namespace, name):
    """Return an InferenceService custom resource as a JSON object."""
    inference_service = api.get_custom_rsrc(
        **versions.inference_service_group_version_kind(),
        namespace=namespace,
        name=name,
    )
    if request.args.get("logs", "false") == "true":
        # find the logs
        return api.success_response(
            "serviceLogs",
            get_inference_service_logs(inference_service),
        )

    # deployment mode information to the response
    deployment_mode = utils.get_deployment_mode(inference_service)
    inference_service["deploymentMode"] = deployment_mode

    return api.success_response("inferenceService", inference_service)


def get_inference_service_logs(inference_service):
    """Return logs for each InferenceService component pod."""
    namespace = inference_service["metadata"]["namespace"]
    components = request.args.getlist("component")

    log.info(components)

    # Check deployment mode to determine how to get logs
    deployment_mode = utils.get_deployment_mode(inference_service)

    if deployment_mode == "ModelMesh":
        # For ModelMesh, get logs from modelmesh-serving deployment
        component_pods_dict = utils.get_modelmesh_pods(
            inference_service, components
        )
    elif deployment_mode == "RawDeployment":
        component_pods_dict = utils.get_raw_inference_service_pods(
            inference_service, components
        )
    else:
        # Serverless mode
        component_pods_dict = utils.get_inference_service_pods(
            inference_service, components
        )

    if len(component_pods_dict.keys()) == 0:
        return {}

    logs_by_component = {}
    log.info("Component pods: %s", component_pods_dict)
    for component, pods in component_pods_dict.items():
        if component not in logs_by_component:
            logs_by_component[component] = []

        for pod in pods:
            logs = api.get_pod_logs(namespace, pod, "kserve-container", auth=False)
            logs_by_component[component].append(
                {"podName": pod, "logs": logs.split("\n")}
            )
    return logs_by_component


@bp.route("/api/namespaces/<namespace>/knativeServices/<name>")
def get_knative_service(namespace, name):
    """Return a Knative Service object as JSON."""
    service = api.get_custom_rsrc(
        **versions.KNATIVE_SERVICE, namespace=namespace, name=name
    )

    return api.success_response("knativeService", service)


@bp.route("/api/namespaces/<namespace>/configurations/<name>")
def get_knative_configuration(namespace, name):
    """Return a Knative Configuration object as JSON."""
    configuration = api.get_custom_rsrc(
        **versions.KNATIVE_CONFIGURATION, namespace=namespace, name=name
    )

    return api.success_response("knativeConfiguration", configuration)


@bp.route("/api/namespaces/<namespace>/revisions/<name>")
def get_knative_revision(namespace, name):
    """Return a Knative Revision object as JSON."""
    revision = api.get_custom_rsrc(
        **versions.KNATIVE_REVISION, namespace=namespace, name=name
    )

    return api.success_response("knativeRevision", revision)


@bp.route("/api/namespaces/<namespace>/routes/<name>")
def get_knative_route(namespace, name):
    """Return a Knative Route object as JSON."""
    route = api.get_custom_rsrc(
        **versions.KNATIVE_ROUTE, namespace=namespace, name=name
    )

    return api.success_response("knativeRoute", route)


@bp.route("/api/namespaces/<namespace>/inferenceservices/<name>/events")
def get_inference_service_events(namespace, name):

    field_selector = api.events_field_selector("InferenceService", name)

    events = api.events.list_events(namespace, field_selector).items

    return api.success_response(
        "events",
        api.serialize(events),
    )


# RawDeployment mode endpoints
@bp.route("/api/namespaces/<namespace>/deployments/<name>")
def get_kubernetes_deployment(namespace, name):
    """Return a Kubernetes Deployment object as JSON."""
    deployment = api.get_custom_rsrc(
        **versions.KUBERNETES_DEPLOYMENT_RESOURCE,
        namespace=namespace,
        name=name,
    )
    return api.success_response("deployment", deployment)


@bp.route("/api/namespaces/<namespace>/services/<name>")
def get_kubernetes_service(namespace, name):
    """Return a Kubernetes Service object as JSON."""
    service = api.get_custom_rsrc(
        **versions.KUBERNETES_SERVICE_RESOURCE,
        namespace=namespace,
        name=name,
    )
    return api.success_response("service", service)


@bp.route("/api/namespaces/<namespace>/hpas/<name>")
def get_kubernetes_hpa(namespace, name):
    """Return a Kubernetes HorizontalPodAutoscaler object as JSON."""
    horizontal_pod_autoscaler = api.get_custom_rsrc(
        **versions.KUBERNETES_HPA_RESOURCE, namespace=namespace, name=name
    )
    return api.success_response("hpa", horizontal_pod_autoscaler)


@bp.route(
    "/api/namespaces/<namespace>/inferenceservices/<name>/" "rawdeployment/<component>"
)
def get_raw_deployment_objects(namespace, name, component):
    """Return all Kubernetes native resources for a RawDeployment component."""

    inference_service = api.get_custom_rsrc(
        **versions.inference_service_group_version_kind(),
        namespace=namespace,
        name=name,
    )

    if not utils.is_raw_deployment(inference_service):
        return api.error_response("InferenceService is not in RawDeployment mode", 400)

    objects = utils.get_raw_deployment_objects(inference_service, component)
    return api.success_response("rawDeploymentObjects", objects)


@bp.route(
    "/api/namespaces/<namespace>/inferenceservices/<name>/" "modelmesh/<component>"
)
def get_modelmesh_objects(namespace, name, component):
    """Return all ModelMesh-specific resources for a ModelMesh component."""

    inference_service = api.get_custom_rsrc(
        **versions.inference_service_group_version_kind(),
        namespace=namespace,
        name=name,
    )

    if not utils.is_modelmesh_deployment(inference_service):
        return api.error_response("InferenceService is not in ModelMesh mode", 400)

    objects = utils.get_modelmesh_objects(inference_service, component)
    return api.success_response("modelmeshObjects", objects)
