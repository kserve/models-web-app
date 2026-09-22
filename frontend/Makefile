# Makefile for frontend setup
COMMON_LIBRARY_DIRECTORY ?= ../common/frontend/kubeflow-common-lib
COMMON_LIBRARY_DISTRIBUTION := $(COMMON_LIBRARY_DIRECTORY)/dist/kubeflow

.PHONY: all setup clean

all: setup

setup:
	@if [ ! -d "$(COMMON_LIBRARY_DIRECTORY)" ]; then \
	    echo "Expected common library at: $(COMMON_LIBRARY_DIRECTORY)"; \
	    exit 1; \
	fi
	@echo ">> Building kubeflow-common-library"
	@cd "$(COMMON_LIBRARY_DIRECTORY)" && \
	    npm install && \
	    npm run build
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
	@echo ">> Copying kubeflow styles and assets"
	@npm run copyCSS
	@npm run copyLibAssets
	@echo "✔ Setup complete. Now run: npm run serve:simple or npm run build:watch"

clean:
	@echo ">> Cleaning frontend node_modules"
	@rm -rf node_modules
