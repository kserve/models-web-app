"""Unit tests for the SSE connection manager.

Run directly with:
    python3 backend/apps/common/sse/manager_test.py
"""

import importlib.util
import json
import logging as python_logging
from pathlib import Path
from queue import Queue
import sys
import types
import unittest


def _load_manager_module():
    """Load manager.py without requiring the external Kubeflow backend package."""
    module_names = (
        "kubeflow",
        "kubeflow.kubeflow",
        "kubeflow.kubeflow.crud_backend",
    )
    original_modules = {name: sys.modules.get(name) for name in module_names}

    kubeflow = types.ModuleType("kubeflow")
    kubeflow_kubeflow = types.ModuleType("kubeflow.kubeflow")
    crud_backend = types.ModuleType("kubeflow.kubeflow.crud_backend")
    crud_backend.logging = types.SimpleNamespace(
        getLogger=lambda name: python_logging.getLogger(name)
    )

    try:
        sys.modules.setdefault("kubeflow", kubeflow)
        sys.modules.setdefault("kubeflow.kubeflow", kubeflow_kubeflow)
        sys.modules["kubeflow.kubeflow.crud_backend"] = crud_backend

        module_path = Path(__file__).with_name("manager.py")
        spec = importlib.util.spec_from_file_location(
            "sse_manager_under_test", module_path
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


manager_module = _load_manager_module()
SSEConnectionManager = manager_module.SSEConnectionManager


class DummyWatcher:
    def __init__(self):
        self.stop_calls = 0

    def stop(self):
        self.stop_calls += 1


class SSEConnectionManagerTest(unittest.TestCase):
    def _message(self, queue):
        raw = queue.get_nowait()
        self.assertTrue(raw.startswith("data: "))
        return json.loads(raw.removeprefix("data: ").strip())

    def test_namespace_watch_is_shared_and_broadcast_to_all_clients(self):
        manager = SSEConnectionManager()
        first_queue = Queue()
        second_queue = Queue()
        watcher = DummyWatcher()
        callbacks = []

        def watcher_factory(namespace, callback):
            callbacks.append((namespace, callback))
            return watcher

        manager.register_namespace_watch("kubeflow-user", first_queue, watcher_factory)
        manager.register_namespace_watch("kubeflow-user", second_queue, watcher_factory)

        self.assertEqual(len(callbacks), 1)
        self.assertEqual(callbacks[0][0], "kubeflow-user")

        callbacks[0][1]("ADDED", {"metadata": {"name": "model-a"}})

        self.assertEqual(
            self._message(first_queue),
            {"type": "ADDED", "object": {"metadata": {"name": "model-a"}}},
        )
        self.assertEqual(
            self._message(second_queue),
            {"type": "ADDED", "object": {"metadata": {"name": "model-a"}}},
        )

        manager.unregister_namespace_watch("kubeflow-user", first_queue)
        self.assertEqual(watcher.stop_calls, 0)

        manager.unregister_namespace_watch("kubeflow-user", second_queue)
        self.assertEqual(watcher.stop_calls, 1)

    def test_namespace_reconnect_does_not_replace_new_watcher_with_old_watcher(self):
        manager = SSEConnectionManager()
        first_queue = Queue()
        second_queue = Queue()
        old_watcher = DummyWatcher()
        new_watcher = DummyWatcher()

        def new_factory(namespace, callback):
            return new_watcher

        def old_factory(namespace, callback):
            manager.unregister_namespace_watch(namespace, first_queue)
            manager.register_namespace_watch(namespace, second_queue, new_factory)
            return old_watcher

        manager.register_namespace_watch("kubeflow-user", first_queue, old_factory)

        self.assertEqual(old_watcher.stop_calls, 1)
        self.assertEqual(new_watcher.stop_calls, 0)

        manager.unregister_namespace_watch("kubeflow-user", second_queue)
        self.assertEqual(new_watcher.stop_calls, 1)

    def test_single_watch_is_shared_and_stops_after_last_client_disconnects(self):
        manager = SSEConnectionManager()
        first_queue = Queue()
        second_queue = Queue()
        watcher = DummyWatcher()
        callbacks = []

        def watcher_factory(namespace, name, callback):
            callbacks.append((namespace, name, callback))
            return watcher

        manager.register_single_watch(
            "kubeflow-user", "model-a", first_queue, watcher_factory
        )
        manager.register_single_watch(
            "kubeflow-user", "model-a", second_queue, watcher_factory
        )

        self.assertEqual(len(callbacks), 1)
        self.assertEqual(callbacks[0][0:2], ("kubeflow-user", "model-a"))

        callbacks[0][2]("MODIFIED", {"metadata": {"name": "model-a"}})

        self.assertEqual(
            self._message(first_queue),
            {"type": "MODIFIED", "object": {"metadata": {"name": "model-a"}}},
        )
        self.assertEqual(
            self._message(second_queue),
            {"type": "MODIFIED", "object": {"metadata": {"name": "model-a"}}},
        )

        manager.unregister_single_watch("kubeflow-user", "model-a", first_queue)
        self.assertEqual(watcher.stop_calls, 0)

        manager.unregister_single_watch("kubeflow-user", "model-a", second_queue)
        self.assertEqual(watcher.stop_calls, 1)

    def test_single_reconnect_does_not_replace_new_watcher_with_old_watcher(self):
        manager = SSEConnectionManager()
        first_queue = Queue()
        second_queue = Queue()
        old_watcher = DummyWatcher()
        new_watcher = DummyWatcher()

        def new_factory(namespace, name, callback):
            return new_watcher

        def old_factory(namespace, name, callback):
            manager.unregister_single_watch(namespace, name, first_queue)
            manager.register_single_watch(namespace, name, second_queue, new_factory)
            return old_watcher

        manager.register_single_watch(
            "kubeflow-user", "model-a", first_queue, old_factory
        )

        self.assertEqual(old_watcher.stop_calls, 1)
        self.assertEqual(new_watcher.stop_calls, 0)

        manager.unregister_single_watch("kubeflow-user", "model-a", second_queue)
        self.assertEqual(new_watcher.stop_calls, 1)


if __name__ == "__main__":
    unittest.main()
