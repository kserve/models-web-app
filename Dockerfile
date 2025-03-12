# --- Clone the kubeflow/kubeflow code ---
FROM ubuntu AS fetch-kubeflow-kubeflow

RUN apt-get update && apt-get install git -y

WORKDIR /kf
COPY ./frontend/COMMIT ./
RUN git clone https://github.com/kubeflow/kubeflow.git && \
    COMMIT=$(cat ./COMMIT) && \
    cd kubeflow && \
    git checkout $COMMIT

# --- Build the backend kubeflow-wheel ---
FROM python:3.12-slim AS backend-kubeflow-wheel

WORKDIR /src

RUN pip install setuptools wheel

ARG BACKEND_LIB=/kf/kubeflow/components/crud-web-apps/common/backend
COPY --from=fetch-kubeflow-kubeflow $BACKEND_LIB .
RUN python setup.py sdist bdist_wheel

# --- Build the frontend kubeflow library ---
FROM node:23-bookworm-slim AS frontend-kubeflow-lib

WORKDIR /src
ENV NODE_OPTIONS="--openssl-legacy-provider"
ARG LIB=/kf/kubeflow/components/crud-web-apps/common/frontend/kubeflow-common-lib
COPY --from=fetch-kubeflow-kubeflow $LIB/package*.json ./
RUN npm ci  # Use ci for stable dependency installs

COPY --from=fetch-kubeflow-kubeflow $LIB/ ./
RUN npm run build

# --- Build the frontend ---
FROM node:23-bookworm-slim AS frontend

WORKDIR /src
ENV NODE_OPTIONS="--openssl-legacy-provider"
COPY ./frontend/package*.json ./
RUN npm ci  # Use ci for a clean install
COPY --from=frontend-kubeflow-lib /src/dist/kubeflow/ ./node_modules/kubeflow/

COPY ./frontend/ .

RUN npm run build -- --output-path=./dist/default --configuration=production

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
ENTRYPOINT ["gunicorn", "-w", "3", "--bind", "0.0.0.0:5000", "--access-logfile", "-", "entrypoint:app"]
