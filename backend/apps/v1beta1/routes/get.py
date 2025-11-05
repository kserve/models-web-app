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


@bp.route("/api/config/namespaces", methods=["GET"])
def get_namespaces():
    """Handle retrieval of available namespaces with optional filtering."""
    log.info("=== MWA NAMESPACES ENDPOINT CALLED ===")

    try:
        # Get all namespaces from the cluster
        all_namespaces = api.list_namespaces()
        all_namespace_names = [ns.metadata.name for ns in all_namespaces.items]

        # Check if ALLOWED_NAMESPACES environment variable is set
        allowed_namespaces_env = os.environ.get("ALLOWED_NAMESPACES", "").strip()

        log.info(
            "ALLOWED_NAMESPACES environment variable: '%s'", allowed_namespaces_env
        )
        log.info("All cluster namespaces: %s", all_namespace_names)

        if not allowed_namespaces_env:
            # No filtering - return all namespaces (default behavior)
            log.info(
                "No ALLOWED_NAMESPACES configured, returning all namespaces: %s",
                all_namespace_names,
            )
            return api.success_response("namespaces", all_namespace_names)

        # Parse the allowed namespaces from environment variable
        allowed_namespaces = [
            ns.strip() for ns in allowed_namespaces_env.split(",") if ns.strip()
        ]

        log.info("Parsed ALLOWED_NAMESPACES: %s", allowed_namespaces)

        if not allowed_namespaces:
            # Empty list after parsing - fallback to all namespaces
            log.warning(
                "ALLOWED_NAMESPACES env var is set but empty after parsing, falling back to all namespaces"
            )
            return api.success_response("namespaces", all_namespace_names)

        # Filter to only include namespaces that exist in the cluster
        valid_allowed_namespaces = [
            ns for ns in allowed_namespaces if ns in all_namespace_names
        ]

        log.info("Valid allowed namespaces: %s", valid_allowed_namespaces)

        if not valid_allowed_namespaces:
            # None of the specified namespaces exist - fallback to all namespaces
            log.warning(
                "None of the ALLOWED_NAMESPACES %s exist in cluster. Available: %s. Falling back to all namespaces.",
                allowed_namespaces,
                all_namespace_names,
            )
            return api.success_response("namespaces", all_namespace_names)

        # Log any invalid namespaces for debugging
        invalid_namespaces = [
            ns for ns in allowed_namespaces if ns not in all_namespace_names
        ]
        if invalid_namespaces:
            log.warning(
                "Invalid namespaces specified in ALLOWED_NAMESPACES (ignored): %s",
                invalid_namespaces,
            )

        log.info(
            "Filtered namespaces based on ALLOWED_NAMESPACES: %s",
            valid_allowed_namespaces,
        )
        return api.success_response("namespaces", valid_allowed_namespaces)

    except Exception as e:
        log.error("Error retrieving namespaces: %s", str(e))
        return api.failed_response("message", "Failed to retrieve namespaces"), 500
