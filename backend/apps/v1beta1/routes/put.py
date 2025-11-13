from flask import request

from kubeflow.kubeflow.crud_backend import api, decorators, logging

from ...common import versions
from . import bp

log = logging.getLogger(__name__)


@bp.route(
    "/api/namespaces/<namespace>/inferenceservices/<inference_service_name>",
    methods=["PUT"],
)
@decorators.request_is_json_type
@decorators.required_body_params("apiVersion", "kind", "metadata", "spec")
def replace_inference_service(namespace: str, inference_service_name: str):
    group_version_kind = versions.inference_service_group_version_kind()
    api.authz.ensure_authorized(
        "update",
        group=group_version_kind["group"],
        version=group_version_kind["version"],
        resource=group_version_kind["kind"],
        namespace=namespace,
    )

    custom_resource = request.get_json()

    api.custom_api.replace_namespaced_custom_object(
        group=group_version_kind["group"],
        version=group_version_kind["version"],
        plural=group_version_kind["kind"],
        namespace=namespace,
        name=inference_service_name,
        body=custom_resource,
    )

    return api.success_response("message", "InferenceService successfully updated")
