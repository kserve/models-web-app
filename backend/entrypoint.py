"""The entrypoint of the backend."""

import os
import sys

from apps import v1beta1
from kubeflow.kubeflow.crud_backend import config, logging

log = logging.getLogger(__name__)


APP_NAME = os.environ.get("APP_NAME", "Models Web App")
BACKEND_MODE = os.environ.get("BACKEND_MODE", config.BackendMode.PRODUCTION.value)

PREFIX = os.environ.get("APP_PREFIX", "/")
APP_VERSION = os.environ.get("APP_VERSION", "v1beta1")

# Grafana configuration
GRAFANA_PREFIX = os.environ.get("GRAFANA_PREFIX", "/grafana")
GRAFANA_CPU_MEMORY_DB = os.environ.get(
    "GRAFANA_CPU_MEMORY_DB", "db/knative-serving-revision-cpu-and-memory-usage"
)
GRAFANA_HTTP_REQUESTS_DB = os.environ.get(
    "GRAFANA_HTTP_REQUESTS_DB", "db/knative-serving-revision-http-requests"
)

backend_configuration = config.get_config(BACKEND_MODE)
backend_configuration.PREFIX = PREFIX
backend_configuration.APP_VERSION = APP_VERSION

# Load the app based on APP_VERSION env var
if APP_VERSION == "v1beta1":
    app = v1beta1.create_app(APP_NAME, backend_configuration)
else:
    log.error("No app for: %s", APP_VERSION)
    sys.exit(1)


if __name__ == "__main__":
    app.run()
