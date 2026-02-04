SHELL=bash

# Local path to kubeflow/notebooks repository for common backend code.
# Clone https://github.com/kubeflow/notebooks to develop locally.
# Set KUBEFLOW_REPOSITORY environment variable or use the default /tmp/notebooks.
KUBEFLOW_REPO ?= $(or $(KUBEFLOW_REPOSITORY),/tmp/notebooks)
COMMON_BACKEND_DIR ?= ${KUBEFLOW_REPO}/components/crud-web-apps/common/backend

install-deps:
	pushd ${COMMON_BACKEND_DIR} && \
	pip install -e . && \
	popd
	pip install -r requirements.txt

run:
	APP_PREFIX=/models \
	gunicorn -w 3 --bind 0.0.0.0:5000 --access-logfile - entrypoint:app

run-dev:
	UI_FLAVOR=default \
	BACKEND_MODE=dev \
	APP_PREFIX=/ \
	gunicorn -w 3 --bind 0.0.0.0:5000 --access-logfile - entrypoint:app
