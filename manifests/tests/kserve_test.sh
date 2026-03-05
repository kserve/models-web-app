#!/bin/bash
set -euxo pipefail

NAMESPACE=${1:-kubeflow-user-example-com}
SCRIPT_DIRECTORY="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

export KSERVE_INGRESS_HOST_PORT=${KSERVE_INGRESS_HOST_PORT:-localhost:8080}
export KSERVE_M2M_TOKEN="$(kubectl -n ${NAMESPACE} create token default-editor)"
export KSERVE_TEST_NAMESPACE=${NAMESPACE}

# The models web application authenticates and authorizes requests based on
# the kubeflow-userid header. For ServiceAccount tokens in this test setup,
# use the corresponding Kubernetes user identity explicitly.
AUTHORIZED_USER_HEADER="kubeflow-userid: system:serviceaccount:${NAMESPACE}:default-editor"
UNAUTHORIZED_USER_HEADER="kubeflow-userid: system:serviceaccount:default:default"

# ============================================================
# Test 1: Model Prediction via KServe Python SDK
# ============================================================
pip install -q pytest
python -m pytest "${SCRIPT_DIRECTORY}/kserve_sklearn_test.py" -vs --log-level info

# ============================================================
# Test 2: Ingress Gateway - Path-based & Host-based Routing (curl)
# ============================================================
cat <<EOF | kubectl apply -f -
apiVersion: "serving.kserve.io/v1beta1"
kind: "InferenceService"
metadata:
  name: "isvc-sklearn"
  namespace: ${NAMESPACE}
spec:
  predictor:
    sklearn:
      storageUri: "gs://kfserving-examples/models/sklearn/1.0/model"
      resources:
        requests:
          cpu: "50m"
          memory: "128Mi"
        limits:
          cpu: "100m"
          memory: "256Mi"
EOF

kubectl wait --for=condition=Ready inferenceservice/isvc-sklearn -n ${NAMESPACE} --timeout=300s

cat <<EOF | kubectl apply -f -
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-isvc-sklearn
  namespace: ${NAMESPACE}
spec:
  action: ALLOW
  rules:
  - {}
  selector:
    matchLabels:
      serving.knative.dev/service: isvc-sklearn-predictor
EOF

sleep 60

RESPONSE_NO_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" \
 -H "Content-Type: application/json" \
 "http://${KSERVE_INGRESS_HOST_PORT}/serving/${NAMESPACE}/isvc-sklearn/v1/models/isvc-sklearn:predict" \
 -d '{"instances": [[6.8, 2.8, 4.8, 1.4]]}')

if [ "$RESPONSE_NO_TOKEN" != "403" ] && [ "$RESPONSE_NO_TOKEN" != "302" ]; then
  echo "FAIL: Path-based: Expected 403/302 without token, got $RESPONSE_NO_TOKEN"
  exit 1
fi

RESPONSE_WITH_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" \
 -H "Authorization: Bearer ${KSERVE_M2M_TOKEN}" \
 -H "Content-Type: application/json" \
 "http://${KSERVE_INGRESS_HOST_PORT}/serving/${NAMESPACE}/isvc-sklearn/v1/models/isvc-sklearn:predict" \
 -d '{"instances": [[6.8, 2.8, 4.8, 1.4], [6.0, 3.4, 4.5, 1.6]]}')

if [ "$RESPONSE_WITH_TOKEN" != "200" ] && [ "$RESPONSE_WITH_TOKEN" != "404" ] && [ "$RESPONSE_WITH_TOKEN" != "503" ]; then
  echo "FAIL: Path-based: Expected 200/404/503 with token, got $RESPONSE_WITH_TOKEN"
  exit 1
fi

HOST_HEADER="Host: isvc-sklearn.${NAMESPACE}.example.com"

RESPONSE_HOST_NO_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" \
 -H "${HOST_HEADER}" \
 -H "Content-Type: application/json" \
 "http://${KSERVE_INGRESS_HOST_PORT}/v1/models/isvc-sklearn:predict" \
 -d '{"instances": [[6.8, 2.8, 4.8, 1.4]]}')

if [ "$RESPONSE_HOST_NO_TOKEN" != "403" ] && [ "$RESPONSE_HOST_NO_TOKEN" != "302" ]; then
  echo "FAIL: Host-based: Expected 403/302 without token, got $RESPONSE_HOST_NO_TOKEN"
  exit 1
fi

RESPONSE_HOST_WITH_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" \
 -H "Authorization: Bearer ${KSERVE_M2M_TOKEN}" \
 -H "${HOST_HEADER}" \
 -H "Content-Type: application/json" \
 "http://${KSERVE_INGRESS_HOST_PORT}/v1/models/isvc-sklearn:predict" \
 -d '{"instances": [[6.8, 2.8, 4.8, 1.4], [6.0, 3.4, 4.5, 1.6]]}')

if [ "$RESPONSE_HOST_WITH_TOKEN" != "200" ] && [ "$RESPONSE_HOST_WITH_TOKEN" != "404" ] && [ "$RESPONSE_HOST_WITH_TOKEN" != "503" ]; then
  echo "FAIL: Host-based: Expected 200/404/503 with token, got $RESPONSE_HOST_WITH_TOKEN"
  exit 1
fi

# ============================================================
# Test 3: KServe Models Web Application API
# ============================================================
kubectl wait --for=condition=Available --timeout=300s -n kubeflow deployment/kserve-models-web-app

TOKEN="$(kubectl -n ${NAMESPACE} create token default-editor)"
BASE_URL="localhost:8080/kserve-endpoints"
BOOTSTRAP_HEADERS=/tmp/kserve_bootstrap_headers.txt
BOOTSTRAP_BODY=/tmp/kserve_bootstrap_body.txt

cat <<EOF | kubectl apply -f -
apiVersion: "serving.kserve.io/v1beta1"
kind: "InferenceService"
metadata:
  name: "sklearn-iris"
  namespace: ${NAMESPACE}
spec:
  predictor:
    sklearn:
      storageUri: "gs://kfserving-examples/models/sklearn/1.0/model"
      resources:
        requests:
          cpu: "50m"
          memory: "128Mi"
        limits:
          cpu: "100m"
          memory: "256Mi"
EOF

kubectl wait --for=condition=Ready inferenceservice/sklearn-iris -n ${NAMESPACE} --timeout=120s
kubectl get inferenceservice sklearn-iris -n ${NAMESPACE}

BOOTSTRAP_STATUS=""
for attempt in $(seq 1 12); do
  BOOTSTRAP_STATUS=$(curl -sS -o "${BOOTSTRAP_BODY}" -D "${BOOTSTRAP_HEADERS}" \
    -c /tmp/kserve_xcrf.txt -w "%{http_code}" \
    "http://${BASE_URL}/" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "${AUTHORIZED_USER_HEADER}")

  if [ "${BOOTSTRAP_STATUS}" = "200" ] && grep -qi '^set-cookie:' "${BOOTSTRAP_HEADERS}"; then
    break
  fi

  if [ "${attempt}" -lt 12 ]; then
    sleep 10
  fi
done

if [ "${BOOTSTRAP_STATUS}" != "200" ]; then
  cat "${BOOTSTRAP_HEADERS}"
  cat "${BOOTSTRAP_BODY}"
  echo "FAILURE: Expected 200 from KServe Models Web Application bootstrap, got ${BOOTSTRAP_STATUS}"
  exit 1
fi

if ! grep -i '^set-cookie:' "${BOOTSTRAP_HEADERS}"; then
  cat "${BOOTSTRAP_HEADERS}"
  cat "${BOOTSTRAP_BODY}"
  echo "FAILURE: Expected Set-Cookie header from KServe Models Web Application bootstrap."
  exit 1
fi

XSRFTOKEN=$(grep XSRF-TOKEN /tmp/kserve_xcrf.txt | awk '{print $NF}')

if [ -z "${XSRFTOKEN}" ]; then
  cat /tmp/kserve_xcrf.txt
  echo "FAILURE: Expected XSRF-TOKEN cookie to be written to cookie jar."
  exit 1
fi

RESPONSE=$(curl -sS --fail-with-body \
  "${BASE_URL}/api/namespaces/${NAMESPACE}/inferenceservices" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "${AUTHORIZED_USER_HEADER}" \
  -H "X-XSRF-TOKEN: ${XSRFTOKEN}" \
  -H "Cookie: XSRF-TOKEN=${XSRFTOKEN}")

echo "$RESPONSE" | grep -q "sklearn-iris" || exit 1
kubectl get inferenceservice sklearn-iris -n ${NAMESPACE} || exit 1
READY=$(kubectl get isvc sklearn-iris -n ${NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
[[ "$READY" == "True" ]] || {
  echo "FAILURE: InferenceService sklearn-iris Ready status is: $READY"
  exit 1
}

kubectl delete inferenceservice sklearn-iris -n ${NAMESPACE} || exit 1

UNAUTH_TOKEN="$(kubectl -n default create token default)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE_URL}/api/namespaces/${NAMESPACE}/inferenceservices" \
  -H "Authorization: Bearer ${UNAUTH_TOKEN}" \
  -H "${UNAUTHORIZED_USER_HEADER}")
[[ "$HTTP_CODE" == "403" || "$HTTP_CODE" == "401" ]] || { echo "FAILURE: Expected 401/403, got $HTTP_CODE"; exit 1; }
echo "Models Web Application: Token from unauthorized ServiceAccount cannot list InferenceServices in $NAMESPACE namespace."

# ============================================================
# Test 4: Knative Service authentication via cluster-local-gateway
# ============================================================
cat <<EOF | kubectl apply -f -
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: secure-model-predictor
  namespace: ${NAMESPACE}
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
    spec:
      containers:
      - image: gcr.io/knative-samples/helloworld-go
        ports:
        - containerPort: 8080
        env:
        - name: TARGET
          value: "Secure KServe Model"
EOF

kubectl wait --for=condition=Ready ksvc/secure-model-predictor -n ${NAMESPACE} --timeout=120s

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Host: secure-model-predictor.${NAMESPACE}.svc.cluster.local" \
    "http://${KSERVE_INGRESS_HOST_PORT}/")

if [ "$RESPONSE" != "403" ]; then
    echo "FAIL: Unauthenticated access should return 403, got $RESPONSE"
    exit 1
fi

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Host: secure-model-predictor.${NAMESPACE}.svc.cluster.local" \
    -H "Authorization: Bearer invalid-token" \
    "http://${KSERVE_INGRESS_HOST_PORT}/")

if [ "$RESPONSE" != "401" ] && [ "$RESPONSE" != "403" ]; then
    echo "FAIL: Invalid token should return 401/403, got $RESPONSE"
    exit 1
fi

# ============================================================
# Test 5: Cluster-local-gateway requires authentication
# ============================================================
kubectl port-forward -n istio-system svc/cluster-local-gateway 8081:80 &
PF_PID=$!
sleep 5

curl -s -o /dev/null -w "%{http_code}" \
    -H "Host: secure-model-predictor.${NAMESPACE}.svc.cluster.local" \
    -H "Authorization: Bearer $KSERVE_M2M_TOKEN" \
    "http://localhost:8081/" > /dev/null

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Host: secure-model-predictor.${NAMESPACE}.svc.cluster.local" \
    "http://localhost:8081/")

if [ "$RESPONSE" != "403" ]; then
    echo "FAIL: Cluster-local-gateway unauthenticated access should return 403, got $RESPONSE"
    exit 1
fi

# ============================================================
# Test 6: Namespace isolation - attacker should NOT have access
# ============================================================
ATTACKER_NAMESPACE="attacker-namespace"
kubectl create namespace ${ATTACKER_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: attacker-service-account
  namespace: ${ATTACKER_NAMESPACE}
EOF

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Host: secure-model-predictor.${NAMESPACE}.svc.cluster.local" \
    "http://localhost:8081/")

if [ "$RESPONSE" == "200" ]; then
    echo "FAIL: Unauthenticated attacker namespace request should be rejected, got $RESPONSE"
    exit 1
fi

ATTACKER_TOKEN=$(kubectl -n ${ATTACKER_NAMESPACE} create token attacker-service-account)

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Host: secure-model-predictor.${NAMESPACE}.svc.cluster.local" \
    -H "Authorization: Bearer $ATTACKER_TOKEN" \
    "http://localhost:8081/")

if [ "$RESPONSE" == "200" ]; then
    echo "FAIL: Attacker namespace token should be rejected (namespace isolation), got $RESPONSE"
    exit 1
fi

# ============================================================
# Cleanup
# ============================================================
kill $PF_PID 2>/dev/null || true

kubectl delete namespace ${ATTACKER_NAMESPACE} --ignore-not-found=true
kubectl delete ksvc secure-model-predictor -n ${NAMESPACE} --ignore-not-found=true
kubectl delete inferenceservice isvc-sklearn -n ${NAMESPACE} --ignore-not-found=true
