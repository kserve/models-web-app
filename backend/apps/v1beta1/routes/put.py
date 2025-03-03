from flask import request

from kubeflow.kubeflow.crud_backend import api, decorators, logging

from ...common import versions
from . import bp

log = logging.getLogger(__name__)


@bp.route("/api/namespaces/<namespace>/inferenceservices/<isvc>",
          methods=["PUT"])
@decorators.request_is_json_type
@decorators.required_body_params("apiVersion", "kind", "metadata", "spec")
def replace_inference_service(namespace: str, isvc: str):
    gvk = versions.inference_service_gvk()
    api.authz.ensure_authorized(
        "update",
        group=gvk["group"],
        version=gvk["version"],
        resource=gvk["kind"],
        namespace=namespace,
    )

    cr = request.get_json()

    api.custom_api.replace_namespaced_custom_object(
        group=gvk["group"],
        version=gvk["version"],
        plural=gvk["kind"],
        namespace=namespace,
        name=isvc,
        body=cr)

    return api.success_response(
        "message",
        "InferenceService successfully updated"
    )
