"""POST routes of the backend."""

from flask import request

from kubeflow.kubeflow.crud_backend import api, decorators, logging

from ...common import versions
from . import bp
from .validators import validate_inference_service

log = logging.getLogger(__name__)


@bp.route("/api/namespaces/<namespace>/inferenceservices", methods=["POST"])
@decorators.request_is_json_type
@decorators.required_body_params("apiVersion", "kind", "metadata", "spec")
def post_inference_service(namespace):
    """Handle creation of an InferenceService."""
    gvk = versions.inference_service_gvk()
    api.authz.ensure_authorized(
        "create",
        group=gvk["group"],
        version=gvk["version"],
        resource=gvk["kind"],
        namespace=namespace,
    )

    customResource = request.get_json()

    result = validate_inference_service(customResource)
    if isinstance(result, tuple):
        return result
    customResource = result

    api.create_custom_rsrc(**gvk, data=customResource, namespace=namespace)

    return api.success_response("message", "InferenceService successfully created.")


@bp.route("/api/namespaces/<namespace>/inferencegraphs", methods=["POST"])
@decorators.request_is_json_type
@decorators.required_body_params("apiVersion", "kind", "metadata", "spec")
def post_inference_graph(namespace):
    """Handle creation of an InferenceGraph."""
    gvk = versions.inference_graph_gvk()
    api.authz.ensure_authorized(
        "create",
        group=gvk["group"],
        version=gvk["version"],
        resource=gvk["kind"],
        namespace=namespace,
    )

    customResource = request.get_json()
    api.create_custom_rsrc(**gvk, data=customResource, namespace=namespace)

    return api.success_response("message", "InferenceGraph successfully created.")
