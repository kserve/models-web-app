"""POST routes of the backend."""

from flask import request

from kubeflow.kubeflow.crud_backend import api, decorators, logging

from ...common import versions
from . import bp

log = logging.getLogger(__name__)


@bp.route("/api/namespaces/<namespace>/inferenceservices", methods=["POST"])
@decorators.request_is_json_type
@decorators.required_body_params("apiVersion", "kind", "metadata", "spec")
def post_inference_service(namespace):
    """Handle creation of an InferenceService."""
    customResource = request.get_json()

    gvk = versions.inference_service_gvk()
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


@bp.route("/api/namespaces/<namespace>/trainedmodels", methods=["POST"])
@decorators.request_is_json_type
@decorators.required_body_params("apiVersion", "kind", "metadata", "spec")
def post_trained_model(namespace):
    """Handle creation of a TrainedModel."""
    customResource = request.get_json()

    gvk = versions.trained_model_gvk()
    api.create_custom_rsrc(**gvk, data=customResource, namespace=namespace)

    return api.success_response("message", "TrainedModel successfully created.")
