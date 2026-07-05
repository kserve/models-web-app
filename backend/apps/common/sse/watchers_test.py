"""Unit tests for SSE Kubernetes watchers.

Run directly with:
    python3 backend/apps/common/sse/watchers_test.py
"""

import importlib.util
import logging as python_logging
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock


def _load_watchers_module():
    """Load watchers.py with lightweight stubs for external dependencies."""
    module_names = (
        "backend",
        "backend.apps",
        "backend.apps.common",
        "backend.apps.common.sse",
        "backend.apps.common.utils",
        "backend.apps.common.versions",
        "kubernetes",
        "kubernetes.client",
        "kubernetes.watch",
        "kubeflow",
        "kubeflow.kubeflow",
        "kubeflow.kubeflow.crud_backend",
    )
    original_modules = {name: sys.modules.get(name) for name in module_names}

    backend = types.ModuleType("backend")
    apps = types.ModuleType("backend.apps")
    common = types.ModuleType("backend.apps.common")
    sse = types.ModuleType("backend.apps.common.sse")
    utils = types.ModuleType("backend.apps.common.utils")
    versions = types.ModuleType("backend.apps.common.versions")
    kubernetes = types.ModuleType("kubernetes")
    client = types.ModuleType("kubernetes.client")
    watch = types.ModuleType("kubernetes.watch")
    kubeflow = types.ModuleType("kubeflow")
    kubeflow_kubeflow = types.ModuleType("kubeflow.kubeflow")
    crud_backend = types.ModuleType("kubeflow.kubeflow.crud_backend")

    backend.__path__ = []
    apps.__path__ = []
    common.__path__ = []
    sse.__path__ = []
    utils.get_deployment_mode = Mock(return_value="Serverless")
    versions.inference_service_gvk = Mock(
        return_value={
            "group": "serving.kserve.io",
            "version": "v1beta1",
            "kind": "inferenceservices",
        }
    )
    watch.Watch = Mock()
    crud_backend.api = types.SimpleNamespace()
    crud_backend.logging = types.SimpleNamespace(
        getLogger=lambda name: python_logging.getLogger(name)
    )

    try:
        sys.modules["backend"] = backend
        sys.modules["backend.apps"] = apps
        sys.modules["backend.apps.common"] = common
        sys.modules["backend.apps.common.sse"] = sse
        sys.modules["backend.apps.common.utils"] = utils
        sys.modules["backend.apps.common.versions"] = versions
        sys.modules["kubernetes"] = kubernetes
        sys.modules["kubernetes.client"] = client
        sys.modules["kubernetes.watch"] = watch
        sys.modules["kubeflow"] = kubeflow
        sys.modules["kubeflow.kubeflow"] = kubeflow_kubeflow
        sys.modules["kubeflow.kubeflow.crud_backend"] = crud_backend

        module_path = Path(__file__).with_name("watchers.py")
        spec = importlib.util.spec_from_file_location(
            "backend.apps.common.sse.watchers_under_test", module_path
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        for name, original_module in original_modules.items():
            if original_module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original_module


class EventWatcherTest(unittest.TestCase):
    def test_event_watcher_uses_common_backend_serializer(self):
        watchers = _load_watchers_module()
        event_obj = object()
        watchers.api.serialize = Mock(
            return_value={"metadata": {"resourceVersion": "123"}}
        )

        serialized = watchers.EventWatcher()._serialize_event(event_obj)

        self.assertEqual(serialized, {"metadata": {"resourceVersion": "123"}})
        watchers.api.serialize.assert_called_once_with(event_obj)


if __name__ == "__main__":
    unittest.main()
