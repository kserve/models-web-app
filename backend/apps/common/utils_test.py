"""Unit tests for locating the pods of Standard InferenceServices.

Run directly with:
    python3 backend/apps/common/utils_test.py

KServe labels the pods of a Standard (RawDeployment) InferenceService with
serving.kserve.io/inferenceservice and component, and these pods carry no
Knative revision label. The Logs tab must find them through those labels.
"""

from datetime import datetime, timezone
import importlib.util
import logging as python_logging
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock


def _load_utils_module():
    """Load utils.py with lightweight stubs for external dependencies."""
    module_names = (
        "backend",
        "backend.apps",
        "backend.apps.common",
        "backend.apps.common.utils",
        "backend.apps.common.versions",
        "kubeflow",
        "kubeflow.kubeflow",
        "kubeflow.kubeflow.crud_backend",
    )
    original_modules = {name: sys.modules.get(name) for name in module_names}

    backend = types.ModuleType("backend")
    apps = types.ModuleType("backend.apps")
    common = types.ModuleType("backend.apps.common")
    versions = types.ModuleType("backend.apps.common.versions")
    kubeflow = types.ModuleType("kubeflow")
    kubeflow_kubeflow = types.ModuleType("kubeflow.kubeflow")
    crud_backend = types.ModuleType("kubeflow.kubeflow.crud_backend")

    backend.__path__ = []
    apps.__path__ = []
    common.__path__ = []
    crud_backend.api = types.SimpleNamespace(
        client=types.SimpleNamespace(V1Pod=object),
        list_pods=Mock(),
        v1_core=types.SimpleNamespace(list_namespaced_pod=Mock()),
    )
    crud_backend.helpers = types.SimpleNamespace()
    crud_backend.logging = types.SimpleNamespace(
        getLogger=lambda name: python_logging.getLogger(name)
    )

    try:
        sys.modules["backend"] = backend
        sys.modules["backend.apps"] = apps
        sys.modules["backend.apps.common"] = common
        sys.modules["backend.apps.common.versions"] = versions
        sys.modules["kubeflow"] = kubeflow
        sys.modules["kubeflow.kubeflow"] = kubeflow_kubeflow
        sys.modules["kubeflow.kubeflow.crud_backend"] = crud_backend

        utils_path = Path(__file__).with_name("utils.py")
        specification = importlib.util.spec_from_file_location(
            "backend.apps.common.utils", utils_path
        )
        module = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(module)
        return module
    finally:
        for name, original_module in original_modules.items():
            if original_module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original_module


utils = _load_utils_module()


def _pod(name, created_hour):
    return types.SimpleNamespace(
        metadata=types.SimpleNamespace(
            name=name,
            labels={},
            creation_timestamp=datetime(2026, 1, 1, created_hour, tzinfo=timezone.utc),
        )
    )


def _standard_inference_service():
    return {
        "metadata": {
            "name": "sklearn-iris",
            "namespace": "kubeflow-user",
            "annotations": {"serving.kserve.io/deploymentMode": "Standard"},
        },
        "status": {"components": {"predictor": {}}},
    }


class ComponentPodLookupTest(unittest.TestCase):
    def setUp(self):
        self.list_namespaced_pod = utils.api.v1_core.list_namespaced_pod
        self.list_namespaced_pod.reset_mock()
        utils.api.list_pods.reset_mock()

    def test_serverless_inference_service_uses_the_knative_revision_pod(self):
        revision_pod = _pod("sklearn-iris-predictor-00001-deployment-a", 1)
        revision_pod.metadata.labels = {
            "serving.knative.dev/revision": "sklearn-iris-predictor-00001"
        }
        utils.api.list_pods.return_value = types.SimpleNamespace(items=[revision_pod])
        serverless_inference_service = {
            "metadata": {"name": "sklearn-iris", "namespace": "kubeflow-user"},
            "status": {
                "components": {
                    "predictor": {
                        "latestCreatedRevision": "sklearn-iris-predictor-00001"
                    }
                }
            },
        }

        latest_pod = utils.get_component_latest_pod(
            serverless_inference_service, "predictor"
        )

        self.assertIs(latest_pod, revision_pod)
        utils.api.list_pods.assert_called_once_with("kubeflow-user", auth=False)
        self.list_namespaced_pod.assert_not_called()

    def test_selects_pods_by_kserve_inference_service_and_component_labels(self):
        self.list_namespaced_pod.return_value = types.SimpleNamespace(
            items=[_pod("sklearn-iris-predictor-a", 1)]
        )

        latest_pod = utils.get_component_latest_pod(
            _standard_inference_service(), "predictor"
        )

        self.assertIsNotNone(latest_pod)
        self.assertEqual(latest_pod.metadata.name, "sklearn-iris-predictor-a")
        self.list_namespaced_pod.assert_called_once_with(
            "kubeflow-user",
            label_selector=(
                "serving.kserve.io/inferenceservice=sklearn-iris,component=predictor"
            ),
        )

    def test_returns_most_recently_created_pod(self):
        self.list_namespaced_pod.return_value = types.SimpleNamespace(
            items=[
                _pod("sklearn-iris-predictor-old", 1),
                _pod("sklearn-iris-predictor-new", 3),
                _pod("sklearn-iris-predictor-middle", 2),
            ]
        )

        latest_pod = utils.get_component_latest_pod(
            _standard_inference_service(), "predictor"
        )

        self.assertIsNotNone(latest_pod)
        self.assertEqual(latest_pod.metadata.name, "sklearn-iris-predictor-new")

    def test_returns_none_without_pods(self):
        self.list_namespaced_pod.return_value = types.SimpleNamespace(items=[])

        latest_pod = utils.get_component_latest_pod(
            _standard_inference_service(), "predictor"
        )

        self.assertIsNone(latest_pod)

    def test_log_stream_selects_pods_by_kserve_inference_service_label(self):
        predictor_pod = _pod("sklearn-iris-predictor-a", 1)
        predictor_pod.metadata.labels = {"component": "predictor"}
        self.list_namespaced_pod.return_value = types.SimpleNamespace(
            items=[predictor_pod]
        )

        component_pods = utils.get_standard_inference_service_pods(
            _standard_inference_service(), ["predictor"]
        )

        self.assertEqual(component_pods, {"predictor": ["sklearn-iris-predictor-a"]})
        self.list_namespaced_pod.assert_called_once_with(
            "kubeflow-user",
            label_selector="serving.kserve.io/inferenceservice=sklearn-iris",
        )


if __name__ == "__main__":
    unittest.main()
