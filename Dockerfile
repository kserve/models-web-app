# --- Build the backend kubeflow wheel ---
FROM python:3.12-slim AS backend-kubeflow-wheel

WORKDIR /src
RUN pip install setuptools wheel

COPY ./common/backend/ ./
RUN python setup.py sdist bdist_wheel

# --- Build the frontend kubeflow library ---
FROM node:22-bookworm-slim AS frontend-kubeflow-lib

WORKDIR /src
COPY ./common/frontend/kubeflow-common-lib/package*.json ./
RUN npm ci --no-audit

COPY ./common/frontend/kubeflow-common-lib/ ./
RUN npm run build

# --- Build the frontend ---
FROM node:22-bookworm-slim AS frontend

WORKDIR /src
COPY ./frontend/package*.json ./

ENV NODE_OPTIONS=--openssl-legacy-provider
RUN npm install --legacy-peer-deps
COPY --from=frontend-kubeflow-lib /src/dist/kubeflow/ ./node_modules/kubeflow/

COPY ./frontend/ .
# Accept version as build argument and update package.json
ARG VERSION
RUN if [ -n "$VERSION" ]; then \
        npm pkg set version="$VERSION"; \
    fi
RUN npm run build -- --output-path=./dist/default

# Web App
FROM python:3.12-slim

WORKDIR /package
COPY --from=backend-kubeflow-wheel /src/dist .
RUN pip3 install *.whl

WORKDIR /src
COPY ./backend/requirements.txt .
RUN pip3 install -r requirements.txt

COPY ./backend/apps/ ./apps
COPY ./backend/entrypoint.py .
COPY ./backend/Makefile .

COPY --from=frontend /src/dist/default/ /src/apps/v1beta1/static/

ENV APP_PREFIX /models
ENV APP_VERSION v1beta1

ENTRYPOINT ["gunicorn", "-w", "3", "--worker-class", "gevent", "--bind", "0.0.0.0:5000", "--access-logfile", "-", "entrypoint:app"]
