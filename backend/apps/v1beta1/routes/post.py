"""POST routes of the backend."""

from copy import deepcopy

from flask import jsonify
from flask import request

from kubeflow.kubeflow.crud_backend import api, decorators, logging

from ...common import versions
from . import bp

log = logging.getLogger(__name__)


def _resource_identity(resource, namespace):
    metadata = resource.get("metadata") or {}
    return {
        "apiVersion": resource.get("apiVersion"),
        "kind": resource.get("kind"),
        "name": metadata.get("name"),
        "namespace": namespace,
    }


def _resource_label(resource):
    identity = _resource_identity(
        resource, (resource.get("metadata") or {}).get("namespace")
    )
    return "%s/%s" % (identity.get("kind"), identity.get("name"))


def _exception_message(exc):
    if getattr(exc, "reason", None):
        return exc.reason
    if getattr(exc, "body", None):
        return exc.body
    return str(exc)


def _exception_status_code(exc):
    status_code = getattr(exc, "status", None) or getattr(exc, "code", None)
    if not isinstance(status_code, int) or status_code < 400:
        return 500
    return status_code


def _error_response(message, status_code=400, **extra):
    payload = {"message": message}
    payload.update({key: value for key, value in extra.items() if value is not None})
    return jsonify(payload), status_code


def _validation_error(message, document_index=None, resource=None, namespace=None):
    return {
        "message": message,
        "failedDocumentIndex": document_index,
        "failedResource": (
            _resource_identity(resource, namespace)
            if isinstance(resource, dict) and resource.get("kind")
            else None
        ),
        "createdResources": [],
    }


def _validate_kserve_resources_payload(payload, namespace):
    if not isinstance(payload, dict):
        return _validation_error("Request body must be a JSON object."), None

    resources = payload.get("resources")
    if not isinstance(resources, list) or len(resources) == 0:
        return (
            _validation_error(
                'Request body must include a non-empty "resources" list.'
            ),
            None,
        )

    validated_resources = []
    supported_resources = ", ".join(versions.supported_kserve_resource_names())

    for index, resource in enumerate(resources, start=1):
        if not isinstance(resource, dict):
            return (
                _validation_error(
                    f"Document {index}: resource must be an object.",
                    document_index=index,
                ),
                None,
            )

        api_version = resource.get("apiVersion")
        kind = resource.get("kind")
        metadata = resource.get("metadata")

        if not api_version:
            return (
                _validation_error(
                    f"Document {index}: missing required field apiVersion.",
                    index,
                    resource,
                    namespace,
                ),
                None,
            )
        if not kind:
            return (
                _validation_error(
                    f"Document {index}: missing required field kind.",
                    index,
                    resource,
                    namespace,
                ),
                None,
            )
        if not isinstance(metadata, dict):
            return (
                _validation_error(
                    f"Document {index}: missing required field metadata.",
                    index,
                    resource,
                    namespace,
                ),
                None,
            )
        if not metadata.get("name"):
            return (
                _validation_error(
                    f"Document {index}: missing required field metadata.name.",
                    index,
                    resource,
                    namespace,
                ),
                None,
            )
        if resource.get("spec") is None:
            return (
                _validation_error(
                    f"Document {index}: missing required field spec.",
                    index,
                    resource,
                    namespace,
                ),
                None,
            )

        gvk = versions.kserve_resource_gvk(api_version, kind)
        if gvk is None:
            return (
                _validation_error(
                    (
                        f"Document {index}: unsupported resource {api_version} {kind}. "
                        f"Supported resources: {supported_resources}."
                    ),
                    index,
                    resource,
                    namespace,
                ),
                None,
            )

        resource_copy = deepcopy(resource)
        resource_copy.setdefault("metadata", {})
        resource_copy["metadata"]["namespace"] = namespace
        validated_resources.append((index, resource_copy, gvk))

    return None, validated_resources


@bp.route("/api/namespaces/<namespace>/inferenceservices", methods=["POST"])
@decorators.request_is_json_type
@decorators.required_body_params("apiVersion", "kind", "metadata", "spec")
def post_inference_service(namespace):
    """Handle creation of an InferenceService."""
    customResource = request.get_json()

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


@bp.route("/api/namespaces/<namespace>/kserve-resources", methods=["POST"])
@decorators.request_is_json_type
def post_kserve_resources(namespace):
    """Handle ordered creation of supported KServe resources."""
    validation_error, resources = _validate_kserve_resources_payload(
        request.get_json(), namespace
    )
    if validation_error:
        message = validation_error.pop("message")
        return _error_response(message, **validation_error)

    created_resources = []
    for document_index, resource, gvk in resources:
        try:
            api.authz.ensure_authorized(
                "create",
                group=gvk["group"],
                version=gvk["version"],
                resource=gvk["kind"],
                namespace=namespace,
            )
            api.create_custom_rsrc(**gvk, data=resource, namespace=namespace)
            created_resources.append(_resource_identity(resource, namespace))
        except Exception as exc:
            log.exception(
                "Failed to create KServe resource from document %s: %s",
                document_index,
                _resource_label(resource),
            )

            return _error_response(
                "Failed to create document %s (%s): %s"
                % (document_index, _resource_label(resource), _exception_message(exc)),
                _exception_status_code(exc),
                failedDocumentIndex=document_index,
                failedResource=_resource_identity(resource, namespace),
                createdResources=created_resources,
            )

    return (
        jsonify(
            {
                "message": "%s KServe resource(s) successfully created."
                % len(created_resources),
                "createdResources": created_resources,
            }
        ),
        201,
    )
