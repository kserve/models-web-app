"""Route handlers for DELETE requests."""

from kubeflow.kubeflow.crud_backend import api, logging

from .. import versions
from . import bp

log = logging.getLogger(__name__)


@bp.route(
    "/api/namespaces/<namespace>/inferenceservices/<inference_service>",
    methods=["DELETE"],
)
def delete_inference_service(inference_service, namespace):
    """Handle DELETE requests and delete the provided InferenceService."""
    log.info("Deleting InferenceService %s/%s'", namespace, inference_service)
    gvk = versions.inference_service_gvk()
    api.delete_custom_rsrc(**gvk, name=inference_service, namespace=namespace)
    return api.success_response(
        "message",
        "InferenceService %s/%s successfully deleted." % (namespace, inference_service),
    )


@bp.route(
    "/api/namespaces/<namespace>/inferencegraphs/<inference_graph>",
    methods=["DELETE"],
)
def delete_inference_graph(inference_graph, namespace):
    """Handle DELETE requests and delete the provided InferenceGraph."""
    log.info("Deleting InferenceGraph %s/%s'", namespace, inference_graph)
    gvk = versions.inference_graph_gvk()
    api.delete_custom_rsrc(**gvk, name=inference_graph, namespace=namespace)
    return api.success_response(
        "message",
        "InferenceGraph %s/%s successfully deleted." % (namespace, inference_graph),
    )
