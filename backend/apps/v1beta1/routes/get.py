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
