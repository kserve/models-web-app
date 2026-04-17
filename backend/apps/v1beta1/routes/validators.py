import re
from typing import Optional

from flask import jsonify
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

SUPPORTED_FRAMEWORKS = {
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
}

STORAGE_URI_PATTERN = re.compile(r"^(gs|s3|https?|pvc)://")
K8S_NAME_PATTERN = re.compile(r"^[a-z0-9]([-.a-z0-9]*[a-z0-9])?$")
K8S_RESOURCE_PATTERN = re.compile(
    r"^[0-9]+(\.[0-9]+)?" r"([munpf]|[kMGTPE]i?|[KMGTPE]|[eE][0-9]+)?$"
)

LEGACY_FRAMEWORK_TYPES = [
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


def _safe_int(value, default=0):
    """Parse a value as int, returning *default* on failure."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


class InferenceServiceRequest(BaseModel):
    """Validates user-supplied form inputs for deploying an InferenceService."""

    # --- Model identity ---
    name: str = Field(
        ...,
        min_length=1,
        max_length=253,
        description="Kubernetes-valid name (lowercase, numbers, hyphens)",
    )
    framework: str = Field(..., description="Model framework")
    framework_version: Optional[str] = Field(
        None,
        description="Framework version (e.g. '2')",
    )
    storage_uri: str = Field(
        ...,
        min_length=1,
        description="Model artifact URI (gs://, s3://, https://, pvc://)",
    )
    runtime: Optional[str] = Field(
        None,
        description="Explicit ServingRuntime name",
    )

    # --- Scaling ---
    min_replicas: int = Field(1, ge=0, le=100, description="Minimum replicas")
    max_replicas: int = Field(1, ge=1, le=100, description="Maximum replicas")

    # --- Resources ---
    gpu: int = Field(0, ge=0, le=16, description="Number of GPUs")
    cpu_request: Optional[str] = Field(None, description="CPU request (e.g. 500m)")
    cpu_limit: Optional[str] = Field(None, description="CPU limit (e.g. 1)")
    memory_request: Optional[str] = Field(
        None, description="Memory request (e.g. 512Mi)"
    )
    memory_limit: Optional[str] = Field(None, description="Memory limit (e.g. 1Gi)")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not K8S_NAME_PATTERN.match(v):
            raise ValueError(
                "Must be a valid Kubernetes name: "
                "lowercase letters, numbers, and hyphens only, "
                "must start and end with an alphanumeric character"
            )
        return v

    @field_validator("framework")
    @classmethod
    def validate_framework(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in SUPPORTED_FRAMEWORKS:
            raise ValueError(
                f"Unsupported framework '{v}'. "
                f"Must be one of: {', '.join(sorted(SUPPORTED_FRAMEWORKS))}"
            )
        return v

    @field_validator("storage_uri")
    @classmethod
    def validate_storage_uri(cls, v: str) -> str:
        v = v.strip()
        if not STORAGE_URI_PATTERN.match(v):
            raise ValueError(
                "Storage URI must start with a supported scheme: "
                "gs://, s3://, http://, https://, or pvc://"
            )
        return v

    @field_validator("cpu_request", "cpu_limit", "memory_request", "memory_limit")
    @classmethod
    def validate_resource_quantity(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if not K8S_RESOURCE_PATTERN.match(v):
            raise ValueError(
                f"Invalid resource quantity '{v}'. "
                "Examples: '500m', '1', '512Mi', '2Gi'"
            )
        return v

    @model_validator(mode="after")
    def validate_replicas_range(self) -> "InferenceServiceRequest":
        if self.min_replicas > self.max_replicas:
            raise ValueError(
                f"min_replicas ({self.min_replicas}) cannot exceed "
                f"max_replicas ({self.max_replicas})"
            )
        return self


class InferenceServicePatchRequest(BaseModel):
    """Like InferenceServiceRequest, but all fields are optional for patches."""

    name: Optional[str] = Field(None, min_length=1, max_length=253)
    framework: Optional[str] = Field(None)
    framework_version: Optional[str] = Field(None)
    storage_uri: Optional[str] = Field(None)
    runtime: Optional[str] = Field(None)
    min_replicas: Optional[int] = Field(None, ge=0, le=100)
    max_replicas: Optional[int] = Field(None, ge=1, le=100)
    gpu: Optional[int] = Field(None, ge=0, le=16)
    cpu_request: Optional[str] = Field(None)
    cpu_limit: Optional[str] = Field(None)
    memory_request: Optional[str] = Field(None)
    memory_limit: Optional[str] = Field(None)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not K8S_NAME_PATTERN.match(v):
            raise ValueError(
                "Must be a valid Kubernetes name: "
                "lowercase letters, numbers, and hyphens only, "
                "must start and end with an alphanumeric character"
            )
        return v

    @field_validator("framework")
    @classmethod
    def validate_framework(cls, v):
        if v is None:
            return v
        v = v.strip().lower()
        if v not in SUPPORTED_FRAMEWORKS:
            raise ValueError(
                f"Unsupported framework '{v}'. "
                f"Must be one of: {', '.join(sorted(SUPPORTED_FRAMEWORKS))}"
            )
        return v

    @field_validator("storage_uri")
    @classmethod
    def validate_storage_uri(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not STORAGE_URI_PATTERN.match(v):
            raise ValueError(
                "Storage URI must start with a supported scheme: "
                "gs://, s3://, http://, https://, or pvc://"
            )
        return v

    @field_validator("cpu_request", "cpu_limit", "memory_request", "memory_limit")
    @classmethod
    def validate_resource_quantity(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if not K8S_RESOURCE_PATTERN.match(v):
            raise ValueError(
                f"Invalid resource quantity '{v}'. "
                "Examples: '500m', '1', '512Mi', '2Gi'"
            )
        return v

    @model_validator(mode="after")
    def validate_replicas_range(self) -> "InferenceServicePatchRequest":
        if (
            self.min_replicas is not None
            and self.max_replicas is not None
            and self.min_replicas > self.max_replicas
        ):
            raise ValueError(
                f"min_replicas ({self.min_replicas}) cannot exceed "
                f"max_replicas ({self.max_replicas})"
            )
        return self


def _extract_predictor_fields(custom_resource: dict) -> dict:
    """Flatten the nested InferenceService JSON into validator-friendly keys.

    Supports both new-style (spec.predictor.model.modelFormat) and
    legacy-style (spec.predictor.sklearn, spec.predictor.xgboost, etc.).
    """
    metadata = custom_resource.get("metadata", {})
    spec = custom_resource.get("spec", {})
    predictor = spec.get("predictor", {})

    framework = ""
    framework_version = None
    storage_uri = ""
    runtime = None
    resources = {}

    model = predictor.get("model", {})
    if model and model.get("modelFormat"):
        model_format = model.get("modelFormat", {})
        framework = model_format.get("name", "")
        framework_version = model_format.get("version")
        storage_uri = model.get("storageUri", "")
        runtime = model.get("runtime")
        resources = model.get("resources", {})
    else:
        for fw_type in LEGACY_FRAMEWORK_TYPES:
            fw_spec = predictor.get(fw_type)
            if fw_spec and isinstance(fw_spec, dict):
                framework = fw_type
                storage_uri = fw_spec.get("storageUri", "")
                framework_version = fw_spec.get("runtimeVersion")
                resources = fw_spec.get("resources", {})
                break

    req_resources = resources.get("requests", {}) if resources else {}
    lim_resources = resources.get("limits", {}) if resources else {}

    return {
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


def validate_inference_service(custom_resource: dict):
    """Validate and sanitize a full InferenceService object (for POST / PUT).

    On success, writes the Pydantic-cleaned values (stripped whitespace,
    normalised framework name, etc.) back into *custom_resource* and returns
    the sanitized dict.

    On failure returns a ``(response, 422)`` tuple.
    """
    flat = _extract_predictor_fields(custom_resource)
    try:
        validated = InferenceServiceRequest(**flat)
    except ValidationError as e:
        err_msgs = [f"{err['loc'][0]}: {err['msg']}" for err in e.errors()]
        return jsonify({"error": "Validation failed: " + " | ".join(err_msgs)}), 422

    _apply_validated_fields(custom_resource, validated)
    return custom_resource


def validate_inference_service_patch(patch_body: dict):
    """Validate and sanitize a merge-patch document for an InferenceService.

    Only the fields present in the patch are validated.  Cleaned values are
    written back into *patch_body* and the sanitized dict is returned.

    Returns the sanitized dict on success or a ``(response, 422)`` tuple
    on failure.
    """
    flat = _extract_predictor_fields(patch_body)

    # For a patch, only validate fields that are actually present.
    # Replace empty/default values with None so the patch model skips them.
    patch_flat = {}
    for key, val in flat.items():
        if key == "name" and not val:
            continue  # name is never in a patch body
        if key in ("min_replicas", "max_replicas") and val == 1:
            # Only validate if explicitly present in the patch
            spec = patch_body.get("spec", {})
            predictor = spec.get("predictor", {})
            k8s_key = "minReplicas" if key == "min_replicas" else "maxReplicas"
            if k8s_key not in predictor:
                continue
        if key == "gpu" and val == 0:
            continue
        if key in ("framework", "storage_uri") and not val:
            continue
        if val is None:
            continue
        patch_flat[key] = val

    if not patch_flat:
        return patch_body  # Empty patch, nothing to validate

    try:
        validated = InferenceServicePatchRequest(**patch_flat)
    except ValidationError as e:
        err_msgs = [f"{err['loc'][0]}: {err['msg']}" for err in e.errors()]
        return jsonify({"error": "Validation failed: " + " | ".join(err_msgs)}), 422

    _apply_validated_patch_fields(patch_body, validated)
    return patch_body


# ---- helpers to write cleaned values back --------------------------------


def _apply_validated_fields(
    custom_resource: dict, validated: InferenceServiceRequest
) -> None:
    """Write Pydantic-sanitised values back into *custom_resource* in place."""
    metadata = custom_resource.setdefault("metadata", {})
    metadata["name"] = validated.name

    spec = custom_resource.setdefault("spec", {})
    predictor = spec.setdefault("predictor", {})

    predictor["minReplicas"] = validated.min_replicas
    predictor["maxReplicas"] = validated.max_replicas

    # Determine whether the resource uses new-style or legacy predictor spec
    model = predictor.get("model")
    if model and model.get("modelFormat"):
        # New-style
        model["modelFormat"]["name"] = validated.framework
        if validated.framework_version is not None:
            model["modelFormat"]["version"] = validated.framework_version
        model["storageUri"] = validated.storage_uri
        if validated.runtime is not None:
            model["runtime"] = validated.runtime
        _apply_resource_quantities(model, validated)
    else:
        # Legacy-style — find the active framework key
        for fw_type in LEGACY_FRAMEWORK_TYPES:
            fw_spec = predictor.get(fw_type)
            if fw_spec and isinstance(fw_spec, dict):
                fw_spec["storageUri"] = validated.storage_uri
                _apply_resource_quantities(fw_spec, validated)
                break


def _apply_validated_patch_fields(
    patch_body: dict, validated: InferenceServicePatchRequest
) -> None:
    """Write Pydantic-sanitised values back into *patch_body* in place."""
    spec = patch_body.get("spec", {})
    predictor = spec.get("predictor", {})

    if validated.min_replicas is not None and "minReplicas" in predictor:
        predictor["minReplicas"] = validated.min_replicas
    if validated.max_replicas is not None and "maxReplicas" in predictor:
        predictor["maxReplicas"] = validated.max_replicas

    model = predictor.get("model", {})
    if validated.framework is not None and model.get("modelFormat"):
        model["modelFormat"]["name"] = validated.framework
    if validated.storage_uri is not None and "storageUri" in model:
        model["storageUri"] = validated.storage_uri

    _apply_resource_quantities_patch(model, validated)


def _apply_resource_quantities(container: dict, validated) -> None:
    """Set resource requests/limits from validated model on *container*."""
    resources = container.setdefault("resources", {})
    requests = resources.get("requests", {})
    limits = resources.get("limits", {})

    if validated.cpu_request is not None:
        requests["cpu"] = validated.cpu_request
    if validated.memory_request is not None:
        requests["memory"] = validated.memory_request
    if validated.cpu_limit is not None:
        limits["cpu"] = validated.cpu_limit
    if validated.memory_limit is not None:
        limits["memory"] = validated.memory_limit

    if requests:
        resources["requests"] = requests
    if limits:
        resources["limits"] = limits


def _apply_resource_quantities_patch(container: dict, validated) -> None:
    """Like _apply_resource_quantities but only touches present fields."""
    resources = container.get("resources", {})
    requests = resources.get("requests", {})
    limits = resources.get("limits", {})

    if validated.cpu_request is not None and "cpu" in requests:
        requests["cpu"] = validated.cpu_request
    if validated.memory_request is not None and "memory" in requests:
        requests["memory"] = validated.memory_request
    if validated.cpu_limit is not None and "cpu" in limits:
        limits["cpu"] = validated.cpu_limit
    if validated.memory_limit is not None and "memory" in limits:
        limits["memory"] = validated.memory_limit
