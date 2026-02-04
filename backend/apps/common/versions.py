"""Helpers with GVK needed, stored in one place."""

from flask import current_app

KNATIVE_ROUTE = {"group": "serving.knative.dev", "version": "v1", "kind": "routes"}
KNATIVE_REVISION = {
    "group": "serving.knative.dev",
    "version": "v1",
    "kind": "revisions",
}
KNATIVE_CONF = {
    "group": "serving.knative.dev",
    "version": "v1",
    "kind": "configurations",
}
KNATIVE_SERVICE = {"group": "serving.knative.dev", "version": "v1", "kind": "services"}

# Kubernetes native resources for Standard mode
K8S_DEPLOYMENT = {"group": "apps", "version": "v1", "kind": "deployments"}
K8S_SERVICE = {"group": "", "version": "v1", "kind": "services"}
K8S_HPA = {"group": "autoscaling", "version": "v2", "kind": "horizontalpodautoscalers"}


def inference_service_gvk():
    """
    Return the GVK needed for an InferenceService.

    This also checks the APP_VERSION env var to detect the version.
    """
    try:
        version = current_app.config["APP_VERSION"]
        if version not in ["v1alpha2", "v1beta1"]:
            version = "v1beta1"
    except RuntimeError:
        version = "v1alpha2"

    return {
        "group": "serving.kserve.io",
        "version": version,
        "kind": "inferenceservices",
    }
