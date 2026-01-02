# Makefile for frontend setup
# Usage examples:
#   make setup
#   make setup KUBEFLOW_REPOSITORY=/path/to/kubeflow
#   make setup KF_REPO=/path/to/kubeflow

KUBEFLOW_REPOSITORY ?= $(or $(KF_REPO),../../notebooks)
KUBEFLOW_REMOTE ?= https://github.com/kubeflow/notebooks

COMMIT_FILE := ./COMMIT
COMMON_LIBRARY_DIRECTORY := $(KUBEFLOW_REPOSITORY)/components/crud-web-apps/common/frontend/kubeflow-common-lib
COMMON_LIBRARY_DISTRIBUTION := $(COMMON_LIBRARY_DIRECTORY)/dist/kubeflow

.PHONY: all setup clean

all: setup

setup:
	@echo ">> Using KUBEFLOW_REPOSITORY=$(KUBEFLOW_REPOSITORY)"
	@if [ ! -f "$(COMMIT_FILE)" ]; then echo "Missing $(COMMIT_FILE) in frontend/"; exit 1; fi
	@if [ ! -d "$(KUBEFLOW_REPOSITORY)/.git" ]; then \
	    echo "Cloning $(KUBEFLOW_REMOTE) into $(KUBEFLOW_REPOSITORY)"; \
	    git clone "$(KUBEFLOW_REMOTE)" "$(KUBEFLOW_REPOSITORY)"; \
	fi
	@echo ">> Checking repository status"
	@TARGET_COMMIT=$$(cat "$(COMMIT_FILE)"); \
	cd "$(KUBEFLOW_REPOSITORY)" && \
	git fetch "$(KUBEFLOW_REMOTE)" notebooks-v1 && \
	git checkout "$$TARGET_COMMIT"
	@if [ ! -d "$(COMMON_LIBRARY_DIRECTORY)" ]; then \
	    echo "Expected common lib at: $(COMMON_LIBRARY_DIRECTORY)"; \
	    echo "Verify KUBEFLOW_REPOSITORY is correct."; \
	    exit 1; \
	fi
	@echo ">> Building kubeflow-common-library"
	@cd "$(COMMON_LIBRARY_DIRECTORY)" && \
	npm install && \
	npm run build
	@echo ">> Installing frontend dependencies and linking kubeflow-common-library"
	@npm install
	@rm -rf node_modules/kubeflow
	@ln -s "$$(readlink -f $(COMMON_LIBRARY_DISTRIBUTION))" node_modules/kubeflow
	@echo "✔ Setup complete. Now run: npm run build:watch"

clean:
	@echo ">> Cleaning frontend node_modules"
	@rm -rf node_modules
