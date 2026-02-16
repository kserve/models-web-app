# Models web application

This web application is responsible for allowing the user to manipulate the Model Servers (Endpoints) in his Kubeflow cluster. To achieve this it provides a user friendly way to handle the lifecycle of `InferenceService` CRs.

The web application currently works with `v1beta1` versions of `InferenceService` objects.

## Documentation

- **[Testing Guide](frontend/TEST.md)** - Comprehensive guide on unit and E2E testing with Jest and Cypress

## Connect to the application

The web application is installed alongside the other KServe components, either in the `kserve` or in the `kubeflow` namespace. There is a `VirtualService` that exposes the application via an Istio Ingress Gateway. Depending on the installation environment the following Ingress Gateway will be used.

| Installation mode | IngressGateway                          |
| ----------------- | --------------------------------------- |
| Standalone KServe | knative-ingress-gateway.knative-serving |
| Kubeflow          | kubeflow-gateway.kubeflow               |

To access the application you will need to navigate with your browser to

```sh
${INGRESS_IP}/models/
```

Alternatively you can access the application via `kubectl port-forward`. In that case you will need to configure the application to:

1. Not perform any authorization checks, since there is no logged in user
2. Work under the `/` prefix
3. Disable Secure cookies, since the app will be exposed under plain http

You can apply the mentioned configurations by doing the following commands:

```bash
# edit the configmap
# CONFIG=config/overlays/kubeflow/kustomization.yaml
CONFIG=config/base/kustomization.yaml
vim ${CONFIG}

# Add the following env vars to the configMapGenerator's literals
# for kserve-models-web-app-config
- APP_PREFIX=/
- APP_DISABLE_AUTH="True"
- APP_SECURE_COOKIES="False"

# reapply the kustomization
# kustomize build config/overlays/kubeflow | kubectl apply -f -
kustomize build config/base | kubectl apply -f -
```

## Configuration

The following is a list of environment variables that can be set for any web app that is using this base app.
| Environment variable | Default value | Description |
| - | - | - |
| APP_PREFIX | /models | Controls the application's prefix, by setting the [base-url](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/base) element |
| APP_DISABLE_AUTH | False | Controls whether the application should use SubjectAccessReviews to ensure the user is authorized to perform an action |
| APP_SECURE_COOKIES | True | Controls whether the app should use [Secure](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#Secure) CSRF cookies. By default the application expects to be exposed with https |
| CSRF_SAMESITE | Strict| Controls the [SameSite value](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#SameSite) of the CSRF cookie |
| USERID_HEADER | kubeflow-userid | Header in each request that will contain the username of the logged in user |
| USERID_PREFIX | "" | Prefix to remove from the `USERID_HEADER` value to extract the logged in user name |
| GRAFANA_PREFIX | /grafana | Controls the Grafana endpoint prefix for metrics dashboards |
| GRAFANA_CPU_MEMORY_DB | db/knative-serving-revision-cpu-and-memory-usage | Grafana dashboard name for CPU and memory metrics |
| GRAFANA_HTTP_REQUESTS_DB | db/knative-serving-revision-http-requests | Grafana dashboard name for HTTP request metrics |
| ALLOWED_NAMESPACES | "" | Comma-separated list of namespaces to allow access to. If empty, all namespaces are accessible. Single namespace auto-selects and hides dropdown. |
| JWT_WARNING_THRESHOLD | 16000 | Size threshold (bytes) for logging warnings about large JWT tokens |
| JWT_ERROR_THRESHOLD | 28000 | Size threshold (bytes) for rejecting requests with oversized JWT tokens |

## Namespace Filtering Configuration

For standalone deployments, configure which namespaces users can access using `ALLOWED_NAMESPACES`:

- **Empty/Unset** (default): All cluster namespaces accessible
- **Single namespace**: `ALLOWED_NAMESPACES="kubeflow-user"` - auto-selected, dropdown hidden
- **Multiple namespaces**: `ALLOWED_NAMESPACES="ns1,ns2,ns3"` - filtered dropdown

Invalid namespaces are ignored; falls back to all namespaces if none are valid.

### Examples

```bash
# Allow access to only one namespace (auto-selected, dropdown hidden)
export ALLOWED_NAMESPACES="kubeflow-user"

# Allow access to multiple specific namespaces
export ALLOWED_NAMESPACES="kubeflow-user,kubeflow-admin,ml-team"

# Default behavior - all namespaces accessible
unset ALLOWED_NAMESPACES
```

### Kubernetes Deployment

Add the environment variable to your deployment configuration:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kserve-models-web-app
spec:
  template:
    spec:
      containers:
      - name: kserve-models-web-app
        env:
        - name: ALLOWED_NAMESPACES
          value: "kubeflow-user,kubeflow-admin"
```

## Grafana Configuration

The application supports runtime configuration of Grafana endpoints and dashboard names, allowing you to use custom Grafana instances and dashboard configurations without rebuilding the application.

If you're deploying on Kubernetes with Kustomize, you can set these values in the application's ConfigMap by editing the `config/base/kustomization.yaml` (or your overlay) under `configMapGenerator` for `kserve-models-web-app-config`. Update the following literals as needed:

- `GRAFANA_PREFIX` (e.g., `/grafana` or `/custom-grafana`)
- `GRAFANA_CPU_MEMORY_DB` (e.g., `db/custom-cpu-memory-dashboard`)
- `GRAFANA_HTTP_REQUESTS_DB` (e.g., `db/custom-http-requests-dashboard`)

After editing, reapply your manifests, for example:

```bash
kustomize build config/base | kubectl apply -f -
```

### Configuration API

You can verify your grafana configuration by accessing the `/api/config` endpoint:

```bash
curl http://your-app-url/api/config
```

Expected response:
```json
{
  "grafanaPrefix": "/custom-grafana",
  "grafanaCpuMemoryDb": "db/custom-cpu-memory-dashboard",
  "grafanaHttpRequestsDb": "db/custom-http-requests-dashboard"
}
```

## Development

The frontend is build with [Angular](https://angular.io/) and the backend is written with the Python [Flask](https://flask.palletsprojects.com/en/1.1.x/) framework.

This web application is utilizing common code from the [kubeflow/notebooks](https://github.com/kubeflow/notebooks/tree/master/components/crud-web-apps/common) repository. We want to enforce the same user experience across our different Kubeflow web applications and also keep them in the same development state. In order to achieve this the applications will be using this shared common code.

This will require us to fetch this common code when we want to either build the application locally or in an OCI container image.

In order to run the application locally you will need to:

1. Build the frontend, in watch mode
2. Run the backend

The `npm run build:watch` command will build the frontend artifacts inside the backend's `static` folder for serving. So in order to see the application you will need to start the backend and connect to `localhost:5000`.

Requirements:

- node 22.0.0
- python 3.12

### Frontend

#### Option 1: Using Makefile (Recommended)

```bash
cd $KSERVE_MODELS_WEB_APPLICATION_REPOSITORY/frontend

# Setup dependencies and build common library
make setup

# Optional: Specify custom Kubeflow repository path. Default: `../../notebooks` (relative to the frontend directory)
# make setup KF_REPO=/path/to/notebooks
# Clean Command: Provides a make clean target to remove node_modules
# make clean

# Build and watch for changes
npm run build:watch
```

#### Option 2: Manual setup

```bash
# build the common library
COMMIT=$(cat ./frontend/COMMIT)
cd $KUBEFLOW_REPOSITORY/components/crud-web-apps/common/frontend/kubeflow-common-lib
git checkout $COMMIT

npm i
npm run build
cd dist/kubeflow
npm link

# run the app frontend
cd $KSERVE_MODELS_WEB_APPLICATION_REPOSITORY/frontend
npm i
npm link kubeflow
npm run build:watch
```

### Backend

#### run it locally

```bash
# create a virtual environment and install dependencies
# https://packaging.python.org/guides/installing-using-pip-and-virtual-environments/
cd $KSERVE_MODELS_WEB_APPLICATION_REPOSITORY/backend
python3.12 -m pip install --user virtualenv
python3.12 -m venv web-application-development
source web-application-development/bin/activate

# install the dependencies on the activated virtual environment
KUBEFLOW_REPOSITORY="/path/to/kubeflow/notebooks" make -C backend install-deps

# run the backend
make -C backend run-dev
```

## Known Issues

### Large JWT Tokens with oauth2-proxy

Users with large JWT tokens (common with Azure AD and extensive group memberships) may encounter request failures.

**Symptoms:**
- Silent request failures or generic errors
- Issues more common in corporate environments

**Solution:**
The deployment includes Gunicorn configuration to handle larger headers:

```yaml
env:
  - name: GUNICORN_CMD_ARGS
    value: --limit-request-field_size 32000
```

**Additional configuration:**
- `JWT_WARNING_THRESHOLD`: Log warnings for large tokens (default: 16000)
- `JWT_ERROR_THRESHOLD`: Reject oversized tokens (default: 28000)

Reference: [oauth2-proxy known issues](https://github.com/kubeflow/manifests/tree/master/common/oauth2-proxy#known-issues)
