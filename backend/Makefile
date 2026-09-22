SHELL=bash

# Local path to the common backend package in this repository.
COMMON_BACKEND_DIRECTORY ?= ../common/backend

install-deps:
	pushd ${COMMON_BACKEND_DIRECTORY} && \
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
