"""Route handlers for DELETE requests."""

from kubeflow.kubeflow.crud_backend import api, logging

from .. import versions
from . import bp

log = logging.getLogger(__name__)


@bp.route(
    "/api/namespaces/<namespace>/inferenceservices/<inference_service>",
    methods=["DELETE"],
)
def delete_inference_service(namespace, inference_service):
    """Handle DELETE requests and delete the provided InferenceService."""
    log.info("Deleting InferenceService %s/%s", namespace, inference_service)
    group_version_kind = versions.inference_service_group_version_kind()
    api.delete_custom_rsrc(
        **group_version_kind, name=inference_service, namespace=namespace
    )
    return api.success_response(
        "message",
        f"InferenceService {namespace}/{inference_service} successfully deleted.",
    )
