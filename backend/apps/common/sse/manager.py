"""SSE Connection Manager for managing watch streams and client connections."""

import json
import threading
from typing import Dict, Set, Callable, Any
from queue import Queue

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

        with self._lock:
            if watch_key not in self._namespace_clients:
                self._namespace_clients[watch_key] = set()
            self._namespace_clients[watch_key].add(client_queue)

            if watch_key not in self._namespace_watchers:
                log.info(f"Starting namespace watch for {namespace}")

                def callback(event_type, obj):
                    self._broadcast_event(watch_key, event_type, obj, is_namespace=True)

                watcher = watcher_factory(namespace, callback)
                self._namespace_watchers[watch_key] = watcher

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

            if watch_key not in self._single_watchers:
                log.info(f"Starting single watch for {namespace}/{name}")

                def callback(event_type, obj):
                    self._broadcast_event(
                        watch_key, event_type, obj, is_namespace=False
                    )

                watcher = watcher_factory(namespace, name, callback)
                self._single_watchers[watch_key] = watcher

    def unregister_namespace_watch(self, namespace: str, client_queue: Queue):
        """
        Unregister a client from namespace-scoped watch updates.

        Args:
            namespace: The namespace being watched
            client_queue: The client's queue to remove
        """
        watch_key = f"ns:{namespace}"

        with self._lock:
            if watch_key in self._namespace_clients:
                self._namespace_clients[watch_key].discard(client_queue)

                # Stop the watcher only when all clients have disconnected
                # This optimizes resource usage by reusing one watcher for multiple clients
                if not self._namespace_clients[watch_key]:
                    log.info(f"Stopping namespace watch for {namespace}")
                    del self._namespace_clients[watch_key]

                    if watch_key in self._namespace_watchers:
                        watcher = self._namespace_watchers[watch_key]
                        if hasattr(watcher, "stop"):
                            watcher.stop()
                        del self._namespace_watchers[watch_key]

    def unregister_single_watch(self, namespace: str, name: str, client_queue: Queue):
        """
        Unregister a client from single resource watch updates.

        Args:
            namespace: The namespace of the resource
            name: The name of the resource
            client_queue: The client's queue to remove
        """
        watch_key = f"single:{namespace}:{name}"

        with self._lock:
            if watch_key in self._single_clients:
                self._single_clients[watch_key].discard(client_queue)

                # Stop the watcher only when all clients have disconnected
                # This optimizes resource usage by reusing one watcher for multiple clients
                if not self._single_clients[watch_key]:
                    log.info(f"Stopping single watch for {namespace}/{name}")
                    del self._single_clients[watch_key]

                    if watch_key in self._single_watchers:
                        watcher = self._single_watchers[watch_key]
                        if hasattr(watcher, "stop"):
                            watcher.stop()
                        del self._single_watchers[watch_key]

    def _broadcast_event(
        self, watch_key: str, event_type: str, obj: Any, is_namespace: bool = True
    ):
        """
        Broadcast an event to all clients watching a resource.

        Args:
            watch_key: The watch key (namespace or single resource)
            event_type: The type of event (ADDED, MODIFIED, DELETED, etc.)
            obj: The Kubernetes object
            is_namespace: Whether this is a namespace-scoped watch
        """
        clients = (
            self._namespace_clients.get(watch_key, set())
            if is_namespace
            else self._single_clients.get(watch_key, set())
        )

        if not clients:
            return

        # Validate event data before broadcasting
        if obj is None:
            log.warning(
                f"Received None object for event type {event_type}, skipping broadcast"
            )
            return

        event_data = {
            "type": event_type,
            "object": obj,
        }

        try:
            message = f"data: {json.dumps(event_data)}\n\n"
        except (TypeError, ValueError) as e:
            log.error(f"Error serializing event data: {e}")
            return

        # Send to all connected clients
        dead_clients = set()
        for client_queue in clients:
            try:
                client_queue.put(message)
            except Exception as e:
                log.error(f"Error sending event to client: {e}")
                dead_clients.add(client_queue)

        # Clean up dead clients
        if dead_clients:
            with self._lock:
                for dead_client in dead_clients:
                    if is_namespace:
                        self._namespace_clients[watch_key].discard(dead_client)
                    else:
                        self._single_clients[watch_key].discard(dead_client)
