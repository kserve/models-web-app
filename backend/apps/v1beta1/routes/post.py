"""POST routes of the backend."""

from flask import request, jsonify
from pydantic import ValidationError

from kubeflow.kubeflow.crud_backend import api, decorators, logging

from ...common import versions
from . import bp
from .validators import InferenceServiceRequest

log = logging.getLogger(__name__)


def _safe_int(value, default=0):
    """Parse a value as int, returning *default* on failure."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


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

    # Flatten the nested InferenceService JSON into Pydantic-friendly keys.
    # Supports both new-style (spec.predictor.model.modelFormat) and
    # legacy-style (spec.predictor.sklearn, spec.predictor.xgboost, etc.).
    metadata = customResource.get("metadata", {})
    spec = customResource.get("spec", {})
    predictor = spec.get("predictor", {})

    framework = ""
    framework_version = None
    storage_uri = ""
    runtime = None
    resources = {}

    model = predictor.get("model", {})
    if model and model.get("modelFormat"):
        # New-style: spec.predictor.model.modelFormat
        model_format = model.get("modelFormat", {})
        framework = model_format.get("name", "")
        framework_version = model_format.get("version")
        storage_uri = model.get("storageUri", "")
        runtime = model.get("runtime")
        resources = model.get("resources", {})
    else:
        # Legacy-style: spec.predictor.<framework>
        legacy_types = [
            "sklearn",
            "xgboost",
            "tensorflow",
            "pytorch",
            "triton",
            "onnx",
            "pmml",
            "lightgbm",
            "paddle",
            "huggingface",
            "custom",
        ]
        for fw_type in legacy_types:
            fw_spec = predictor.get(fw_type)
            if fw_spec and isinstance(fw_spec, dict):
                framework = fw_type
                storage_uri = fw_spec.get("storageUri", "")
                framework_version = fw_spec.get("runtimeVersion")
                resources = fw_spec.get("resources", {})
                break

    req_resources = resources.get("requests", {}) if resources else {}
    lim_resources = resources.get("limits", {}) if resources else {}

    flat = {
        "name": metadata.get("name", ""),
        "framework": framework,
        "framework_version": framework_version,
        "storage_uri": storage_uri,
        "runtime": runtime,
        "min_replicas": predictor.get("minReplicas", 1),
        "max_replicas": predictor.get("maxReplicas", 1),
        "gpu": _safe_int(lim_resources.get("nvidia.com/gpu", 0)),
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
