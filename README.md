# Models web app

This web application is responsible for allowing the user to manipulate the Model Servers (Endpoints) in his Kubeflow cluster. To achieve this it provides a user friendly way to handle the lifecycle of `InferenceService` CRs.

The web applucation currently works with `v1beta1` versions of `InferenceService` objects.

## Connect to the application

The web application is installed alongside the other KServe components, either in the `kserve` or in the `kubeflow` namespace. There is a `VirtualService` that exposes the application via an Istio Ingress Gateway. Depending on the installation environment the following Ingress Gateway will be used.

| Installation mode | IngressGateway |
| - | - |
| Standalone KServe | knative-ingress-gateway.knative-serving |
| Kubeflow | kubeflow-gateway.kubeflow |

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
| ENV Var | Default value | Description |
| - | - | - |
| APP_PREFIX | /models | Controls the application's prefix, by setting the [base-url](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/base) element |
| APP_DISABLE_AUTH | False | Controls whether the application should use SubjectAccessReviews to ensure the user is authorized to perform an action |
| APP_SECURE_COOKIES | True | Controls whether the app should use [Secure](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#Secure) CSRF cookies. By default the application expects to be exposed with https |
| CSRF_SAMESITE | Strict| Controls the [SameSite value](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#SameSite) of the CSRF cookie |
| USERID_HEADER | kubeflow-userid | Header in each request that will contain the username of the logged in user |
| USERID_PREFIX | "" | Prefix to remove from the `USERID_HEADER` value to extract the logged in user name |

## Development

The frontend is build with [Angular](https://angular.io/) and the backend is written with the Python [Flask](https://flask.palletsprojects.com/en/1.1.x/) framework.

This web application is utilizing common code from the [kubeflow/kubeflow](https://github.com/kubeflow/kubeflow/tree/master/components/crud-web-apps/common) repository. We want to enforce the same user experience across our different Kubeflow web applications and also keep them in the same development state. In order to achieve this the applications will be using this shared common code.

This will require us to fetch this common code when we want to either build the application locally or in an OCI container image.

In order to run the application locally you will need to:
1. Build the frontend, in watch mode
2. Run the backend

The `npm run build:watch` command will build the frontend artifacts inside the backend's `static` folder for serving. So in order to see the application you will need to start the backend and connect to `localhost:5000`.

Requirements:
* node 22.0.0
* python 3.12

### Frontend
```bash
# build the common library
COMMIT=$(cat ./frontend/COMMIT)
cd $KUBEFLOW_REPO/components/crud-web-apps/common/frontend/kubeflow-common-lib
git checkout $COMMIT

npm i
npm run build
cd dist/kubeflow
npm link

# run the app frontend
cd $KSERVE_MODELS_WEB_APP_REPO/frontend
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
python3.12 -m venv web-applicatio -development
source web-application-development/bin/activate

# install the dependencies on the activated virtual environment 
KUBEFLOW_REPOSITORY="/path/to/kubeflow/kubeflow" make -C backend install-deps

# run the backend
make -C backend run-dev
```

