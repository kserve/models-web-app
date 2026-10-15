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

    def test_namespace_watch_replays_initial_snapshot_to_late_client(self):
        manager = SSEConnectionManager()
        first_queue = Queue()
        second_queue = Queue()
        callbacks = []

        def watcher_factory(namespace, callback):
            callbacks.append((namespace, callback))
            return DummyWatcher()

        manager.register_namespace_watch("kubeflow-user", first_queue, watcher_factory)
        callbacks[0][1]("INITIAL", {"items": [{"metadata": {"name": "model-a"}}]})

        manager.register_namespace_watch("kubeflow-user", second_queue, watcher_factory)

        self.assertEqual(len(callbacks), 1)
        self.assertEqual(
            self._message(second_queue),
            {"type": "INITIAL", "items": [{"metadata": {"name": "model-a"}}]},
        )

    def test_namespace_watch_replays_current_snapshot_to_late_client(self):
        manager = SSEConnectionManager()
        first_queue = Queue()
        second_queue = Queue()
        callbacks = []

        def watcher_factory(namespace, callback):
            callbacks.append((namespace, callback))
            return DummyWatcher()

        manager.register_namespace_watch("kubeflow-user", first_queue, watcher_factory)
        callbacks[0][1]("INITIAL", {"items": [{"metadata": {"name": "model-a"}}]})
        callbacks[0][1]("ADDED", {"metadata": {"name": "model-b"}})

        manager.register_namespace_watch("kubeflow-user", second_queue, watcher_factory)

        self.assertEqual(
            self._message(second_queue),
            {
                "type": "INITIAL",
                "items": [
                    {"metadata": {"name": "model-a"}},
                    {"metadata": {"name": "model-b"}},
                ],
            },
        )

    def _late_client_with_racing_event(
        self, register_client_callable, deliver_newer_event_callable
    ):
        """Register a late client while a watcher delivers a newer event.

        The late client's queue starts the watcher callback from another thread
        the moment the replayed snapshot is enqueued, and waits briefly for it.
        """
        import threading

        class RacingQueue(Queue):
            def __init__(self):
                super().__init__()
                self.has_started_racing_event = False
                self.racing_event_thread = None

            def put_nowait(self, item):
                if not self.has_started_racing_event:
                    self.has_started_racing_event = True
                    self.racing_event_thread = threading.Thread(
                        target=deliver_newer_event_callable
                    )
                    self.racing_event_thread.start()
                    self.racing_event_thread.join(timeout=0.3)
                super().put_nowait(item)

        queue = RacingQueue()
        register_client_callable(queue)
        queue.racing_event_thread.join(timeout=5)
        return queue

    def test_namespace_replay_is_not_overtaken_by_a_newer_event(self):
        manager = SSEConnectionManager()
        callbacks = []

        def watcher_factory(namespace, callback):
            callbacks.append(callback)
            return DummyWatcher()

        manager.register_namespace_watch("kubeflow-user", Queue(), watcher_factory)
        callbacks[0]("INITIAL", {"items": [{"metadata": {"name": "model-a"}}]})

        late_client_queue = self._late_client_with_racing_event(
            lambda queue: manager.register_namespace_watch(
                "kubeflow-user", queue, watcher_factory
            ),
            lambda: callbacks[0]("ADDED", {"metadata": {"name": "model-b"}}),
        )

        self.assertEqual(self._message(late_client_queue)["type"], "INITIAL")
        self.assertEqual(self._message(late_client_queue)["type"], "ADDED")

    def test_single_replay_is_not_overtaken_by_a_newer_event(self):
        manager = SSEConnectionManager()
        callbacks = []

        def watcher_factory(namespace, name, callback):
            callbacks.append(callback)
            return DummyWatcher()

        manager.register_single_watch(
            "kubeflow-user", "model-a", Queue(), watcher_factory
        )
        callbacks[0]("INITIAL", {"metadata": {"name": "model-a"}, "v": 1})

        late_client_queue = self._late_client_with_racing_event(
            lambda queue: manager.register_single_watch(
                "kubeflow-user", "model-a", queue, watcher_factory
            ),
            lambda: callbacks[0]("MODIFIED", {"metadata": {"name": "model-a"}, "v": 2}),
        )

        self.assertEqual(self._message(late_client_queue)["type"], "INITIAL")
        self.assertEqual(self._message(late_client_queue)["type"], "MODIFIED")

    def test_disconnected_namespace_watcher_cannot_update_new_clients(self):
        manager = SSEConnectionManager()
        old_queue = Queue()
        new_queue = Queue()
        callbacks = []

        def watcher_factory(namespace, callback):
            callbacks.append(callback)
            return DummyWatcher()

        manager.register_namespace_watch("kubeflow-user", old_queue, watcher_factory)
        manager.unregister_namespace_watch("kubeflow-user", old_queue)
        manager.register_namespace_watch("kubeflow-user", new_queue, watcher_factory)
        callbacks[1]("INITIAL", {"items": [{"metadata": {"name": "current"}}]})
        self._message(new_queue)
        callbacks[0]("INITIAL", {"items": [{"metadata": {"name": "obsolete"}}]})
        self.assertTrue(new_queue.empty())
        late_queue = Queue()
        manager.register_namespace_watch("kubeflow-user", late_queue, watcher_factory)
        self.assertEqual(
            self._message(late_queue)["items"][0]["metadata"]["name"], "current"
        )

    def test_disconnected_single_watcher_cannot_update_new_clients(self):
        manager = SSEConnectionManager()
        old_queue = Queue()
        new_queue = Queue()
        callbacks = []

        def watcher_factory(namespace, name, callback):
            callbacks.append(callback)
            return DummyWatcher()

        manager.register_single_watch(
            "kubeflow-user", "model", old_queue, watcher_factory
        )
        manager.unregister_single_watch("kubeflow-user", "model", old_queue)
        manager.register_single_watch(
            "kubeflow-user", "model", new_queue, watcher_factory
        )
        current_object = {"metadata": {"name": "model"}, "status": {"ready": True}}
        callbacks[1]("INITIAL", current_object)
        self._message(new_queue)
        callbacks[0]("DELETED", {"metadata": {"name": "model"}})
        self.assertTrue(new_queue.empty())
        late_queue = Queue()
        manager.register_single_watch(
            "kubeflow-user", "model", late_queue, watcher_factory
        )
        self.assertEqual(
            self._message(late_queue), {"type": "INITIAL", "object": current_object}
        )

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

    def test_single_watch_replays_initial_snapshot_to_late_client(self):
        manager = SSEConnectionManager()
        first_queue = Queue()
        second_queue = Queue()
        callbacks = []

        def watcher_factory(namespace, name, callback):
            callbacks.append((namespace, name, callback))
            return DummyWatcher()

        manager.register_single_watch(
            "kubeflow-user", "model-a", first_queue, watcher_factory
        )
        callbacks[0][2]("INITIAL", {"metadata": {"name": "model-a"}})

        manager.register_single_watch(
            "kubeflow-user", "model-a", second_queue, watcher_factory
        )

        self.assertEqual(len(callbacks), 1)
        self.assertEqual(
            self._message(second_queue),
            {"type": "INITIAL", "object": {"metadata": {"name": "model-a"}}},
        )

    def test_single_watch_replays_current_object_to_late_client(self):
        manager = SSEConnectionManager()
        first_queue = Queue()
        second_queue = Queue()
        callbacks = []

        def watcher_factory(namespace, name, callback):
            callbacks.append((namespace, name, callback))
            return DummyWatcher()

        manager.register_single_watch(
            "kubeflow-user", "model-a", first_queue, watcher_factory
        )
        callbacks[0][2](
            "INITIAL",
            {"metadata": {"name": "model-a"}, "status": {"url": "http://old"}},
        )
        callbacks[0][2](
            "MODIFIED",
            {"metadata": {"name": "model-a"}, "status": {"url": "http://new"}},
        )

        manager.register_single_watch(
            "kubeflow-user", "model-a", second_queue, watcher_factory
        )

        self.assertEqual(
            self._message(second_queue),
            {
                "type": "INITIAL",
                "object": {
                    "metadata": {"name": "model-a"},
                    "status": {"url": "http://new"},
                },
            },
        )

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
