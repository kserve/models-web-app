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
    custom_resource = request.get_json()

    group_version_kind = versions.inference_service_group_version_kind()
    api.create_custom_rsrc(
        **group_version_kind, data=custom_resource, namespace=namespace
    )

    return api.success_response("message", "InferenceService successfully created.")
