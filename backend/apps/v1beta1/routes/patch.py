"""PATCH routes for InferenceService resources."""

from flask import request

from kubeflow.kubeflow.crud_backend import api, decorators, logging

from ...common import versions
from . import bp
from .validators import validate_inference_service_patch

log = logging.getLogger(__name__)


@bp.route(
    "/api/namespaces/<namespace>/inferenceservices/<inference_service>",
    methods=["PATCH"],
)
@decorators.request_is_json_type
def patch_inference_service(namespace: str, inference_service: str):
    """Apply a merge-patch to an existing InferenceService.

    Expects a JSON merge-patch document (RFC 7396) as the request body.
    Only the fields present in the patch are updated; all other fields are
    preserved by the Kubernetes API server.
    """
    gvk = versions.inference_service_gvk()
    api.authz.ensure_authorized(
        "update",
        group=gvk["group"],
        version=gvk["version"],
        resource=gvk["kind"],
        namespace=namespace,
    )

    patch_body = request.get_json()

    result = validate_inference_service_patch(patch_body)
    if isinstance(result, tuple):
        return result
    patch_body = result

    api.custom_api.patch_namespaced_custom_object(
        group=gvk["group"],
        version=gvk["version"],
        plural=gvk["kind"],
        namespace=namespace,
        name=inference_service,
        body=patch_body,
    )

    return api.success_response("message", "InferenceService successfully updated")
