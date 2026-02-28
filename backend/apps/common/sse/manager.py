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
        queue_id = id(client_queue)

        with self._lock:
            if watch_key not in self._namespace_clients:
                self._namespace_clients[watch_key] = set()

            self._namespace_clients[watch_key].add(client_queue)
            log.info(
                f"Registered client queue {queue_id} for {namespace}. Total clients for this namespace: {len(self._namespace_clients[watch_key])}"
            )

            # Always create a new watcher for each client
            # This ensures every client gets the INITIAL event
            log.info(f"Starting namespace watch for {namespace} (queue_id: {queue_id})")

            def callback(event_type, obj):
                # Only broadcast to this specific client
                self._broadcast_to_client(client_queue, event_type, obj)

            watcher = watcher_factory(namespace, callback)
            # Store watcher with client queue as key so we can stop it when client disconnects
            if watch_key not in self._namespace_watchers:
                self._namespace_watchers[watch_key] = {}
            self._namespace_watchers[watch_key][queue_id] = watcher
            log.info(
                f"Watcher created and stored for {namespace} (queue_id: {queue_id}). Total watchers: {len(self._namespace_watchers[watch_key])}"
            )

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

            # Always create a new watcher for each client
            log.info(f"Starting single watch for {namespace}/{name}")

            def callback(event_type, obj):
                # Only broadcast to this specific client
                self._broadcast_to_client(client_queue, event_type, obj)

            watcher = watcher_factory(namespace, name, callback)
            # Store watcher with client queue as key
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
                log.info(
                    f"Unregistered client queue {queue_id} for {namespace}. Remaining clients: {len(self._namespace_clients[watch_key])}"
                )

                # Get the watcher but stop it outside the lock
                if (
                    watch_key in self._namespace_watchers
                    and queue_id in self._namespace_watchers[watch_key]
                ):
                    watcher_to_stop = self._namespace_watchers[watch_key][queue_id]
                    del self._namespace_watchers[watch_key][queue_id]
                    log.info(
                        f"Removed watcher for queue {queue_id}. Remaining watchers for {namespace}: {len(self._namespace_watchers[watch_key])}"
                    )

                # Clean up empty structures
                if not self._namespace_clients[watch_key]:
                    del self._namespace_clients[watch_key]
                    log.info(f"No more clients for {namespace}, cleaned up client set")
                if (
                    watch_key in self._namespace_watchers
                    and not self._namespace_watchers[watch_key]
                ):
                    del self._namespace_watchers[watch_key]
                    log.info(
                        f"No more watchers for {namespace}, cleaned up watcher dict"
                    )

        # Stop the watcher outside the lock to avoid blocking
        if watcher_to_stop and hasattr(watcher_to_stop, "stop"):
            log.info(
                f"Calling stop() on watcher for {namespace} (queue_id: {queue_id})"
            )
            watcher_to_stop.stop()
            log.info(
                f"Stopped watcher for client on namespace {namespace} (queue_id: {queue_id})"
            )

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

                # Get the watcher but stop it outside the lock
                if (
                    watch_key in self._single_watchers
                    and queue_id in self._single_watchers[watch_key]
                ):
                    watcher_to_stop = self._single_watchers[watch_key][queue_id]
                    del self._single_watchers[watch_key][queue_id]

                # Clean up empty structures
                if not self._single_clients[watch_key]:
                    del self._single_clients[watch_key]
                if (
                    watch_key in self._single_watchers
                    and not self._single_watchers[watch_key]
                ):
                    del self._single_watchers[watch_key]

        # Stop the watcher outside the lock to avoid blocking
        if watcher_to_stop and hasattr(watcher_to_stop, "stop"):
            watcher_to_stop.stop()
            log.info(f"Stopped watcher for client on {namespace}/{name}")

    def _broadcast_to_client(self, client_queue: Queue, event_type: str, obj: Any):
        """
        Broadcast an event to a single client.

        Args:
            client_queue: The client's queue
            event_type: The type of event (ADDED, MODIFIED, DELETED, etc.)
            obj: The Kubernetes object
        """
        if obj is None:
            log.warning(
                f"Received None object for event type {event_type}, skipping broadcast"
            )
            return

        # For INITIAL events, extract items from the list response
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
            log.info(
                f"Putting message in queue (qsize before={client_queue.qsize()}): type={event_type}"
            )
            client_queue.put(message)
            log.info(f"Message put in queue (qsize after={client_queue.qsize()})")
        except Exception as e:
            log.error(f"Error sending event to client: {e}")

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
        log.debug(f"Broadcasting event type={event_type} for key={watch_key}")
        clients = (
            self._namespace_clients.get(watch_key, set())
            if is_namespace
            else self._single_clients.get(watch_key, set())
        )

        log.debug(f"Number of clients for {watch_key}: {len(clients)}")
        if not clients:
            log.warning(f"No clients registered for {watch_key}")
            return

        # Validate event data before broadcasting
        if obj is None:
            log.warning(
                f"Received None object for event type {event_type}, skipping broadcast"
            )
            return

        # For INITIAL events, extract items from the list response
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
            log.debug(
                f"Successfully serialized event, message length: {len(message)} bytes"
            )
        except (TypeError, ValueError) as e:
            log.error(f"Error serializing event data: {e}", exc_info=True)
            return

        # Send to all connected clients
        dead_clients = set()
        sent_count = 0
        for client_queue in clients:
            try:
                client_queue.put(message)
                sent_count += 1
            except Exception as e:
                log.error(f"Error sending event to client: {e}")
                dead_clients.add(client_queue)

        log.debug(f"Sent event to {sent_count} clients, {len(dead_clients)} dead")

        # Clean up dead clients
        if dead_clients:
            with self._lock:
                for dead_client in dead_clients:
                    if is_namespace:
                        self._namespace_clients[watch_key].discard(dead_client)
                    else:
                        self._single_clients[watch_key].discard(dead_client)
