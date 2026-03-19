"""POST routes of the backend."""

from flask import request, jsonify
from pydantic import ValidationError

from kubeflow.kubeflow.crud_backend import api, decorators, logging

from ...common import versions
from . import bp
from .validators import InferenceServiceRequest

log = logging.getLogger(__name__)


@bp.route("/api/namespaces/<namespace>/inferenceservices", methods=["POST"])
@decorators.request_is_json_type
@decorators.required_body_params("apiVersion", "kind", "metadata", "spec")
def post_inference_service(namespace):
    """Handle creation of an InferenceService."""
    customResource = request.get_json()

    # Flatten the nested InferenceService JSON into Pydantic-friendly keys
    metadata = customResource.get("metadata", {})
    spec = customResource.get("spec", {})
    predictor = spec.get("predictor", {})
    model = predictor.get("model", {})
    model_format = model.get("modelFormat", {})
    resources = model.get("resources", {})
    req_resources = resources.get("requests", {})
    lim_resources = resources.get("limits", {})

    flat = {
        "name": metadata.get("name", ""),
        "framework": model_format.get("name", ""),
        "framework_version": model_format.get("version"),
        "storage_uri": model.get("storageUri", ""),
        "runtime": model.get("runtime"),
        "min_replicas": predictor.get("minReplicas", 1),
        "max_replicas": predictor.get("maxReplicas", 1),
        "gpu": int(lim_resources.get("nvidia.com/gpu", 0)),
        "cpu_request": req_resources.get("cpu"),
        "cpu_limit": lim_resources.get("cpu"),
        "memory_request": req_resources.get("memory"),
        "memory_limit": lim_resources.get("memory"),
    }

    try:
        InferenceServiceRequest(**flat)
    except ValidationError as e:
        err_msgs = [f"{err['loc'][0]}: {err['msg']}" for err in e.errors()]
        return jsonify({"error": "Validation failed: " + " | ".join(err_msgs)}), 422

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
