# Makefile for frontend setup
# Usage examples:
#   make setup
#   make setup KUBEFLOW_REPOSITORY=/path/to/kubeflow
#   make setup KF_REPO=/path/to/kubeflow

KUBEFLOW_REPOSITORY ?= $(or $(KF_REPO),../../kubeflow)
KUBEFLOW_REMOTE ?= https://github.com/kubeflow/kubeflow

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
	@if [ ! -d "$(COMMON_LIBRARY_DIRECTORY)" ]; then \
	    echo "Expected common lib at: $(COMMON_LIBRARY_DIRECTORY)"; \
	    echo "Verify KUBEFLOW_REPOSITORY is correct."; \
	    exit 1; \
	fi
	@echo ">> Checking kubeflow-common-lib status"
	@TARGET_COMMIT=$$(cat "$(COMMIT_FILE)"); \
	if [ -d "$(COMMON_LIBRARY_DISTRIBUTION)" ] && [ "$$(cd "$(COMMON_LIBRARY_DIRECTORY)" && git rev-parse HEAD)" = "$$(cd "$(COMMON_LIBRARY_DIRECTORY)" && git rev-parse "$$TARGET_COMMIT")" ]; then \
	    echo ">> kubeflow-common-library is up-to-date at commit $$TARGET_COMMIT; skipping build"; \
	else \
	    echo ">> Building kubeflow-common-library at commit $$TARGET_COMMIT"; \
	    cd "$(COMMON_LIBRARY_DIRECTORY)" && \
	    git fetch --all --tags && \
	    git checkout "$$TARGET_COMMIT" && \
	    npm install && \
	    npm run build; \
	fi
	@cd "$(COMMON_LIBRARY_DIRECTORY)" && cd dist/kubeflow && npm link
	@echo ">> Installing frontend dependencies and linking kubeflow-common-library"
	@npm install
	@npm link kubeflow
	@echo "✔ Setup complete. Now run: npm run build:watch"

clean:
	@echo ">> Cleaning frontend node_modules"
	@rm -rf node_modules
