from flask import request


from kubeflow.kubeflow.crud_backend import api, decorators, logging

from ...common import versions
from . import bp

log = logging.getLogger(__name__)


@bp.route(
    "/api/namespaces/<namespace>/inferenceservices/<inferenceService>", methods=["PUT"]
)
@decorators.request_is_json_type
@decorators.required_body_params("apiVersion", "kind", "metadata", "spec")
def replace_inference_service(namespace: str, inferenceService: str):
    gvk = versions.inference_service_gvk()
    api.authz.ensure_authorized(
        "update",
        group=gvk["group"],
        version=gvk["version"],
        resource=gvk["kind"],
        namespace=namespace,
    )

    customResource = request.get_json()

    api.custom_api.replace_namespaced_custom_object(
        group=gvk["group"],
        version=gvk["version"],
        plural=gvk["kind"],
        namespace=namespace,
        name=inferenceService,
        body=customResource,
    )

    return api.success_response("message", "InferenceService successfully updated")


@bp.route(
    "/api/namespaces/<namespace>/inferencegraphs/<inference_graph>", methods=["PUT"]
)
@decorators.request_is_json_type
@decorators.required_body_params("apiVersion", "kind", "metadata", "spec")
def replace_inference_graph(namespace: str, inference_graph: str):
    """Handle update of an InferenceGraph."""
    gvk = versions.inference_graph_gvk()
    api.authz.ensure_authorized(
        "update",
        group=gvk["group"],
        version=gvk["version"],
        resource=gvk["kind"],
        namespace=namespace,
    )

    customResource = request.get_json()

    api.custom_api.replace_namespaced_custom_object(
        group=gvk["group"],
        version=gvk["version"],
        plural=gvk["kind"],
        namespace=namespace,
        name=inference_graph,
        body=customResource,
    )

    return api.success_response("message", "InferenceGraph successfully updated")
