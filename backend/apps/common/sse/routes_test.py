"""Unit tests for SSE route helpers.

Run directly with:
    python3 backend/apps/common/sse/routes_test.py
"""

import importlib.util
import logging as python_logging
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock


def _load_routes_module():
    """Load routes.py with lightweight stubs for external dependencies."""
    module_names = (
        "backend",
        "backend.apps",
        "backend.apps.common",
        "backend.apps.common.sse",
        "backend.apps.common.sse.watchers",
        "backend.apps.common.versions",
        "flask",
        "kubeflow",
        "kubeflow.kubeflow",
        "kubeflow.kubeflow.crud_backend",
    )
    original_modules = {name: sys.modules.get(name) for name in module_names}

    backend = types.ModuleType("backend")
    apps = types.ModuleType("backend.apps")
    common = types.ModuleType("backend.apps.common")
    sse = types.ModuleType("backend.apps.common.sse")
    watchers = types.ModuleType("backend.apps.common.sse.watchers")
    versions = types.ModuleType("backend.apps.common.versions")
    flask = types.ModuleType("flask")
    kubeflow = types.ModuleType("kubeflow")
    kubeflow_kubeflow = types.ModuleType("kubeflow.kubeflow")
    crud_backend = types.ModuleType("kubeflow.kubeflow.crud_backend")

    backend.__path__ = []
    apps.__path__ = []
    common.__path__ = []
    sse.__path__ = []
    watchers.InferenceServiceWatcher = Mock()
    watchers.EventWatcher = Mock()
    watchers.LogWatcher = Mock()
    versions.inference_service_gvk = Mock(
        return_value={
            "group": "serving.kserve.io",
            "version": "v1beta1",
            "kind": "inferenceservices",
        }
    )
    flask.Blueprint = Mock()
    flask.Response = Mock()
    flask.request = types.SimpleNamespace(args=types.SimpleNamespace(getlist=Mock()))
    crud_backend.authz = types.SimpleNamespace()
    crud_backend.authz.ensure_authorized = Mock()
    crud_backend.logging = types.SimpleNamespace(
        getLogger=lambda name: python_logging.getLogger(name)
    )

    try:
        sys.modules["backend"] = backend
        sys.modules["backend.apps"] = apps
        sys.modules["backend.apps.common"] = common
        sys.modules["backend.apps.common.sse"] = sse
        sys.modules["backend.apps.common.sse.watchers"] = watchers
        sys.modules["backend.apps.common.versions"] = versions
        sys.modules["flask"] = flask
        sys.modules["kubeflow"] = kubeflow
        sys.modules["kubeflow.kubeflow"] = kubeflow_kubeflow
        sys.modules["kubeflow.kubeflow.crud_backend"] = crud_backend

        module_path = Path(__file__).with_name("routes.py")
        spec = importlib.util.spec_from_file_location(
            "backend.apps.common.sse.routes_under_test", module_path
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


class SseRouteAuthorizationTest(unittest.TestCase):
    def test_authorizes_namespace_stream_with_list_access(self):
        routes = _load_routes_module()

        routes._authorize_inference_service_stream("kubeflow-user", "list")

        routes.authz.ensure_authorized.assert_called_once_with(
            "list",
            "serving.kserve.io",
            "v1beta1",
            "inferenceservices",
            "kubeflow-user",
        )

    def test_authorizes_event_stream_with_event_list_access(self):
        routes = _load_routes_module()

        routes._authorize_events_stream("kubeflow-user")

        routes.authz.ensure_authorized.assert_called_once_with(
            "list", "", "v1", "events", "kubeflow-user"
        )


if __name__ == "__main__":
    unittest.main()
