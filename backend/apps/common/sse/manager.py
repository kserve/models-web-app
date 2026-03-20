"""SSE Connection Manager for managing watch streams and client connections."""

import json
import threading
from typing import Dict, Set, Callable, Any
from queue import Queue, Full

from kubeflow.kubeflow.crud_backend import logging

log = logging.getLogger(__name__)


class SSEConnectionManager:
    """Manages SSE connections and Kubernetes watch streams."""

    def __init__(self):
        """Initialize the SSE connection manager."""
        self._namespace_watchers: Dict[str, Any] = {}
        self._single_watchers: Dict[str, Any] = {}
        self._namespace_clients: Dict[str, Set[Queue]] = {}
        self._single_clients: Dict[str, Set[Queue]] = {}
        self._lock = threading.Lock()

    def register_namespace_watch(
        self, namespace: str, client_queue: Queue, watcher_factory: Callable
    ):
        """
        Register a client for namespace-scoped watch updates.

        Args:
            namespace: The namespace to watch
            client_queue: Queue for sending events to the client
            watcher_factory: Factory function to create a watcher if needed
        """
        watch_key = f"ns:{namespace}"
        queue_id = id(client_queue)

        with self._lock:
            if watch_key not in self._namespace_clients:
                self._namespace_clients[watch_key] = set()

            self._namespace_clients[watch_key].add(client_queue)

            def callback(event_type, obj):
                self._broadcast_to_client(client_queue, event_type, obj)

            watcher = watcher_factory(namespace, callback)
            if watch_key not in self._namespace_watchers:
                self._namespace_watchers[watch_key] = {}
            self._namespace_watchers[watch_key][queue_id] = watcher

    def register_single_watch(
        self, namespace: str, name: str, client_queue: Queue, watcher_factory: Callable
    ):
        """
        Register a client for single resource watch updates.

        Args:
            namespace: The namespace of the resource
            name: The name of the resource
            client_queue: Queue for sending events to the client
            watcher_factory: Factory function to create a watcher if needed
        """
        watch_key = f"single:{namespace}:{name}"

        with self._lock:
            if watch_key not in self._single_clients:
                self._single_clients[watch_key] = set()

            self._single_clients[watch_key].add(client_queue)

            def callback(event_type, obj):
                self._broadcast_to_client(client_queue, event_type, obj)

            watcher = watcher_factory(namespace, name, callback)
            if watch_key not in self._single_watchers:
                self._single_watchers[watch_key] = {}
            self._single_watchers[watch_key][id(client_queue)] = watcher

    def unregister_namespace_watch(self, namespace: str, client_queue: Queue):
        """
        Unregister a client from namespace-scoped watch updates.

        Args:
            namespace: The namespace being watched
            client_queue: The client's queue to remove
        """
        watch_key = f"ns:{namespace}"
        queue_id = id(client_queue)
        watcher_to_stop = None

        with self._lock:
            if watch_key in self._namespace_clients:
                self._namespace_clients[watch_key].discard(client_queue)

                if (
                    watch_key in self._namespace_watchers
                    and queue_id in self._namespace_watchers[watch_key]
                ):
                    watcher_to_stop = self._namespace_watchers[watch_key][queue_id]
                    del self._namespace_watchers[watch_key][queue_id]

                if not self._namespace_clients[watch_key]:
                    del self._namespace_clients[watch_key]
                if (
                    watch_key in self._namespace_watchers
                    and not self._namespace_watchers[watch_key]
                ):
                    del self._namespace_watchers[watch_key]

        if watcher_to_stop and hasattr(watcher_to_stop, "stop"):
            watcher_to_stop.stop()

    def unregister_single_watch(self, namespace: str, name: str, client_queue: Queue):
        """
        Unregister a client from single resource watch updates.

        Args:
            namespace: The namespace of the resource
            name: The name of the resource
            client_queue: The client's queue to remove
        """
        watch_key = f"single:{namespace}:{name}"
        queue_id = id(client_queue)
        watcher_to_stop = None

        with self._lock:
            if watch_key in self._single_clients:
                self._single_clients[watch_key].discard(client_queue)

                if (
                    watch_key in self._single_watchers
                    and queue_id in self._single_watchers[watch_key]
                ):
                    watcher_to_stop = self._single_watchers[watch_key][queue_id]
                    del self._single_watchers[watch_key][queue_id]

                if not self._single_clients[watch_key]:
                    del self._single_clients[watch_key]
                if (
                    watch_key in self._single_watchers
                    and not self._single_watchers[watch_key]
                ):
                    del self._single_watchers[watch_key]

        if watcher_to_stop and hasattr(watcher_to_stop, "stop"):
            watcher_to_stop.stop()

    def _broadcast_to_client(self, client_queue: Queue, event_type: str, obj: Any):
        """
        Broadcast an event to a single client.

        Args:
            client_queue: The client's queue
            event_type: The type of event (ADDED, MODIFIED, DELETED, etc.)
            obj: The Kubernetes object
        """
        if obj is None:
            return

        if event_type == "INITIAL" and isinstance(obj, dict) and "items" in obj:
            event_data = {
                "type": event_type,
                "items": obj["items"],
            }
        else:
            event_data = {
                "type": event_type,
                "object": obj,
            }

        try:
            message = f"data: {json.dumps(event_data)}\n\n"
            client_queue.put_nowait(message)
        except Full:
            log.warning(f"Client queue full, dropping event type={event_type}")
        except Exception as e:
            log.error(f"Error sending event to client: {e}")
