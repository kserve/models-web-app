import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

SUPPORTED_FRAMEWORKS = {
    "sklearn",
    "tensorflow",
    "pytorch",
    "xgboost",
    "huggingface",
    "onnx",
    "triton",
    "custom",
}

STORAGE_URI_PATTERN = re.compile(r"^(gs|s3|https?|pvc)://")
K8S_NAME_PATTERN = re.compile(r"^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")
K8S_RESOURCE_PATTERN = re.compile(r"^[0-9]+(\.[0-9]+)?(m|Ki|Mi|Gi|Ti)?$")


class InferenceServiceRequest(BaseModel):
    """Validates user-supplied form inputs for deploying an InferenceService."""

    # --- Model identity ---
    name: str = Field(
        ..., min_length=1, max_length=253,
        description="Kubernetes-valid name (lowercase, numbers, hyphens)",
    )
    framework: str = Field(..., description="Model framework")
    framework_version: Optional[str] = Field(
        None, description="Framework version (e.g. '2')",
    )
    storage_uri: str = Field(
        ..., min_length=1,
        description="Model artifact URI (gs://, s3://, https://, pvc://)",
    )
    runtime: Optional[str] = Field(
        None, description="Explicit ServingRuntime name",
    )

    # --- Scaling ---
    min_replicas: int = Field(1, ge=0, le=100, description="Minimum replicas")
    max_replicas: int = Field(1, ge=1, le=100, description="Maximum replicas")

    # --- Resources ---
    gpu: int = Field(0, ge=0, le=16, description="Number of GPUs")
    cpu_request: Optional[str] = Field(None, description="CPU request (e.g. 500m)")
    cpu_limit: Optional[str] = Field(None, description="CPU limit (e.g. 1)")
    memory_request: Optional[str] = Field(None, description="Memory request (e.g. 512Mi)")
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
