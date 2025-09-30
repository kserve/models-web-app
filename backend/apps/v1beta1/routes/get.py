"""GET routes of the backend."""

import os
from flask import jsonify

from kubeflow.kubeflow.crud_backend import api, logging

from . import bp

log = logging.getLogger(__name__)


@bp.route("/api/config", methods=["GET"])
def get_config():
    """Handle retrieval of application configuration."""
    try:
        config = {
            "grafanaPrefix": os.environ.get("GRAFANA_PREFIX", "/grafana"),
            "grafanaCpuMemoryDb": os.environ.get(
                "GRAFANA_CPU_MEMORY_DB",
                "db/knative-serving-revision-cpu-and-memory-usage",
            ),
            "grafanaHttpRequestsDb": os.environ.get(
                "GRAFANA_HTTP_REQUESTS_DB", "db/knative-serving-revision-http-requests"
            ),
        }

        log.info("Configuration requested: %s", config)
        return jsonify(config)
    except Exception as e:
        log.error("Error retrieving configuration: %s", str(e))
        return api.error_response("message", "Failed to retrieve configuration"), 500


@bp.route("/api/namespaces", methods=["GET"])
def get_namespaces():
    """Handle retrieval of allowed namespaces based on ALLOWED_NAMESPACES env var."""
    try:
        allowed_namespaces_env = os.environ.get("ALLOWED_NAMESPACES", "")
        
        if allowed_namespaces_env:

            allowed_list = [ns.strip() for ns in allowed_namespaces_env.split(",") if ns.strip()]
            log.info("Filtering namespaces based on ALLOWED_NAMESPACES: %s", allowed_list)
            all_namespaces = api.list_namespaces()
            existing_namespaces = [ns.metadata.name for ns in all_namespaces.items]
            filtered_namespaces = [ns for ns in allowed_list if ns in existing_namespaces]
            
            if not filtered_namespaces:
                log.warning("None of the allowed namespaces exist: %s", allowed_list)
                response_namespaces = existing_namespaces
            else:
                response_namespaces = filtered_namespaces
        else:
            log.info("No ALLOWED_NAMESPACES specified, returning all namespaces")
            all_namespaces = api.list_namespaces()
            response_namespaces = [ns.metadata.name for ns in all_namespaces.items]

        log.info("Returning namespaces: %s", response_namespaces)
        return api.success_response("namespaces", response_namespaces)
    except Exception as e:
        log.error("Error retrieving namespaces: %s", str(e))
        return api.error_response("message", "Failed to retrieve namespaces"), 500
