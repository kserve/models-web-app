# Makefile for frontend setup
# Usage examples:
#   make setup
#   make setup KUBEFLOW_REPOSITORY=/path/to/kubeflow
#   make setup KF_REPO=/path/to/kubeflow

# Local path to kubeflow/notebooks repoSITORY for THE common frontend library.
# Clone https://github.com/kubeflow/notebooks to develop locally.
# Set KUBEFLOW_REPOSITORY ennvironment variable, or use the default ../../notebooks.
KUBEFLOW_REPOSITORY ?= $(../../notebooks)
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
	@TARGET_COMMIT=$$(cat "$(COMMIT_FILE)"); \
	CURRENT_COMMIT=$$(cd "$(KUBEFLOW_REPOSITORY)" 2>/dev/null && git rev-parse --short=8 HEAD 2>/dev/null || echo ""); \
	if [ "$$CURRENT_COMMIT" != "$$TARGET_COMMIT" ]; then \
	    echo ">> Checking out target commit $$TARGET_COMMIT"; \
	    cd "$(KUBEFLOW_REPOSITORY)" && \
	    git fetch "$(KUBEFLOW_REMOTE)" notebooks-v1 && \
	    git checkout "$$TARGET_COMMIT" || git checkout "$$(git rev-parse $$TARGET_COMMIT)"; \
	else \
	    echo ">> Already at target commit $$TARGET_COMMIT"; \
	fi
	@if [ ! -d "$(COMMON_LIBRARY_DIRECTORY)" ]; then \
	    echo "Expected common library at: $(COMMON_LIBRARY_DIRECTORY)"; \
	    echo "Verify KUBEFLOW_REPOSITORY is correct."; \
	    exit 1; \
	fi
	@if [ ! -d "$(COMMON_LIBRARY_DISTRIBUTION)" ]; then \
	    echo ">> Building kubeflow-common-library"; \
	    cd "$(COMMON_LIBRARY_DIRECTORY)" && \
	    npm install && \
	    npm run build; \
	else \
	    echo ">> Kubeflow library already built"; \
	fi
	@if [ ! -d "node_modules" ]; then \
	    echo ">> Installing frontend dependencies"; \
	    npm install; \
	else \
	    echo ">> Frontend dependencies already installed"; \
	fi
	@if [ ! -L "node_modules/kubeflow" ] || [ "$$(readlink node_modules/kubeflow)" != "$$(readlink -f $(COMMON_LIBRARY_DISTRIBUTION))" ]; then \
	    echo ">> Linking kubeflow-common-library"; \
	    rm -rf node_modules/kubeflow; \
	    ln -s "$$(readlink -f $(COMMON_LIBRARY_DISTRIBUTION))" node_modules/kubeflow; \
	else \
	    echo ">> Kubeflow library already linked"; \
	fi
	@if [ ! -d "src/styles" ] || [ ! -d "src/assets" ]; then \
	    echo ">> Copying kubeflow styles and assets"; \
	    npm run copyCSS; \
	    npm run copyLibAssets; \
	else \
	    echo ">> Styles and assets already copied"; \
	fi
	@echo "✔ Setup complete. Now run: npm run serve:simple or npm run build:watch"

clean:
	@echo ">> Cleaning frontend node_modules"
	@rm -rf node_modules
