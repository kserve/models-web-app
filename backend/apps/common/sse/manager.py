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
        start_watcher = False
        watcher_token = None
        callback = None

        with self._lock:
            if watch_key not in self._namespace_clients:
                self._namespace_clients[watch_key] = set()

            self._namespace_clients[watch_key].add(client_queue)

            if watch_key not in self._namespace_watchers:
                watcher_token = object()
                self._namespace_watchers[watch_key] = watcher_token
                start_watcher = True

                def callback(event_type, obj):
                    self._broadcast_to_clients(
                        self._namespace_clients, watch_key, event_type, obj
                    )

        if start_watcher:
            watcher = watcher_factory(namespace, callback)
            watcher_to_stop = None

            with self._lock:
                if (
                    self._namespace_watchers.get(watch_key) is watcher_token
                    and watch_key in self._namespace_clients
                ):
                    self._namespace_watchers[watch_key] = watcher
                else:
                    watcher_to_stop = watcher

            if watcher_to_stop and hasattr(watcher_to_stop, "stop"):
                watcher_to_stop.stop()

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
        start_watcher = False
        watcher_token = None
        callback = None

        with self._lock:
            if watch_key not in self._single_clients:
                self._single_clients[watch_key] = set()

            self._single_clients[watch_key].add(client_queue)

            if watch_key not in self._single_watchers:
                watcher_token = object()
                self._single_watchers[watch_key] = watcher_token
                start_watcher = True

                def callback(event_type, obj):
                    self._broadcast_to_clients(
                        self._single_clients, watch_key, event_type, obj
                    )

        if start_watcher:
            watcher = watcher_factory(namespace, name, callback)
            watcher_to_stop = None

            with self._lock:
                if (
                    self._single_watchers.get(watch_key) is watcher_token
                    and watch_key in self._single_clients
                ):
                    self._single_watchers[watch_key] = watcher
                else:
                    watcher_to_stop = watcher

            if watcher_to_stop and hasattr(watcher_to_stop, "stop"):
                watcher_to_stop.stop()

    def unregister_namespace_watch(self, namespace: str, client_queue: Queue):
        """
        Unregister a client from namespace-scoped watch updates.

        Args:
            namespace: The namespace being watched
            client_queue: The client's queue to remove
        """
        watch_key = f"ns:{namespace}"
        watcher_to_stop = None

        with self._lock:
            if watch_key in self._namespace_clients:
                self._namespace_clients[watch_key].discard(client_queue)

                if not self._namespace_clients[watch_key]:
                    del self._namespace_clients[watch_key]
                    watcher_to_stop = self._namespace_watchers.pop(watch_key, None)

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
        watcher_to_stop = None

        with self._lock:
            if watch_key in self._single_clients:
                self._single_clients[watch_key].discard(client_queue)

                if not self._single_clients[watch_key]:
                    del self._single_clients[watch_key]
                    watcher_to_stop = self._single_watchers.pop(watch_key, None)

        if watcher_to_stop and hasattr(watcher_to_stop, "stop"):
            watcher_to_stop.stop()

    def _broadcast_to_clients(
        self,
        clients_by_key: Dict[str, Set[Queue]],
        watch_key: str,
        event_type: str,
        obj: Any,
    ):
        """
        Broadcast an event to all clients registered for a watch key.

        Args:
            clients_by_key: Mapping of watch keys to client queues
            watch_key: The watch key that received an event
            event_type: The type of event (ADDED, MODIFIED, DELETED, etc.)
            obj: The Kubernetes object
        """
        with self._lock:
            client_queues = list(clients_by_key.get(watch_key, set()))

        for client_queue in client_queues:
            self._broadcast_to_client(client_queue, event_type, obj)

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
