#!/usr/bin/env python3

from pathlib import Path
import sys


def replace_once(text: str, old: str, new: str, path: Path) -> str:
    if old not in text:
        raise SystemExit(f"expected block not found in {path}: {old[:80]!r}")
    return text.replace(old, new, 1)


def patch_install_script(root: Path) -> None:
    path = root / "tests" / "kserve_install.sh"
    text = path.read_text()
    if "deployment/kserve-models-web-app" in text:
        text = text.replace(
            "deployment/kserve-models-web-app",
            "deployment/kserve-models-web-application",
            1,
        )
    path.write_text(text)


def patch_kserve_test(root: Path) -> None:
    path = root / "tests" / "kserve_test.sh"
    text = path.read_text()

    text = replace_once(
        text,
        "export KSERVE_TEST_NAMESPACE=${NAMESPACE}\n",
        """export KSERVE_TEST_NAMESPACE=${NAMESPACE}

# The models web application authenticates and authorizes requests based on
# the kubeflow-userid header. For ServiceAccount tokens in this test setup,
# use the corresponding Kubernetes user identity explicitly.
AUTHORIZED_USER_HEADER="kubeflow-userid: system:serviceaccount:${NAMESPACE}:default-editor"
UNAUTHORIZED_USER_HEADER="kubeflow-userid: system:serviceaccount:default:default"
""",
        path,
    )

    text = replace_once(
        text,
        "kubectl wait --for=condition=Available --timeout=300s -n kubeflow deployment/kserve-models-web-app",
        "kubectl wait --for=condition=Available --timeout=300s -n kubeflow deployment/kserve-models-web-application",
        path,
    )

    text = replace_once(
        text,
        'BASE_URL="localhost:8080/kserve-endpoints"\n',
        """WEB_APP_PORT_FORWARD_PID=""
cleanup_web_app_port_forward() {
  if [ -n "${WEB_APP_PORT_FORWARD_PID}" ]; then
    kill "${WEB_APP_PORT_FORWARD_PID}" 2>/dev/null || true
  fi
}
trap cleanup_web_app_port_forward EXIT

kubectl port-forward -n kubeflow svc/kserve-models-web-application 8082:80 >/tmp/kserve_models_web_application_port_forward.log 2>&1 &
WEB_APP_PORT_FORWARD_PID=$!
sleep 5

BASE_URL="localhost:8082"
BOOTSTRAP_HEADERS=/tmp/kserve_bootstrap_headers.txt
BOOTSTRAP_BODY=/tmp/kserve_bootstrap_body.txt
""",
        path,
    )

    text = replace_once(
        text,
        """# Get XSRF token for API calls
curl -s "http://${BASE_URL}/" \\
  -H "Authorization: Bearer ${TOKEN}" \\
  -v -c /tmp/kserve_xcrf.txt 2>&1 | grep -i "set-cookie"
XSRFTOKEN=$(grep XSRF-TOKEN /tmp/kserve_xcrf.txt | awk '{print $NF}')
""",
        """BOOTSTRAP_STATUS=""
for attempt in $(seq 1 12); do
  BOOTSTRAP_STATUS=$(curl -sS -o "${BOOTSTRAP_BODY}" -D "${BOOTSTRAP_HEADERS}" \\
    -c /tmp/kserve_xcrf.txt -w "%{http_code}" \\
    "http://${BASE_URL}/" \\
    -H "Authorization: Bearer ${TOKEN}" \\
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
""",
        path,
    )

    text = replace_once(
        text,
        """RESPONSE=$(curl -s --fail-with-body \\
  "${BASE_URL}/api/namespaces/${NAMESPACE}/inferenceservices" \\
  -H "Authorization: Bearer ${TOKEN}" \\
  -H "X-XSRF-TOKEN: ${XSRFTOKEN}" \\
  -H "Cookie: XSRF-TOKEN=${XSRFTOKEN}")
""",
        """RESPONSE=$(curl -sS --fail-with-body \\
  "${BASE_URL}/api/namespaces/${NAMESPACE}/inferenceservices" \\
  -H "Authorization: Bearer ${TOKEN}" \\
  -H "${AUTHORIZED_USER_HEADER}" \\
  -H "X-XSRF-TOKEN: ${XSRFTOKEN}" \\
  -H "Cookie: XSRF-TOKEN=${XSRFTOKEN}")
""",
        path,
    )

    text = replace_once(
        text,
        'HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/namespaces/${NAMESPACE}/inferenceservices" -H "Authorization: Bearer ${UNAUTH_TOKEN}")',
        """HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \\
  "${BASE_URL}/api/namespaces/${NAMESPACE}/inferenceservices" \\
  -H "Authorization: Bearer ${UNAUTH_TOKEN}" \\
  -H "${UNAUTHORIZED_USER_HEADER}")""",
        path,
    )

    path.write_text(text)


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    patch_install_script(root)
    patch_kserve_test(root)


if __name__ == "__main__":
    main()
