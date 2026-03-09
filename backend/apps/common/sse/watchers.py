"""Kubernetes resource watchers for real-time updates."""

import threading
import time
from typing import Callable, Optional, List

from kubernetes import client, watch
from kubeflow.kubeflow.crud_backend import api, logging
from .. import utils, versions

log = logging.getLogger(__name__)


class InferenceServiceWatcher:
    """Watches InferenceService resources for changes."""

    def __init__(self, app=None):
        """Initialize the watcher.

        Args:
            app: Flask application instance (for request context in threads)
        """
        self._stop_event = threading.Event()
        self._thread = None
        self._app = app

    def watch_namespace(self, namespace: str, callback: Callable):
        """
        Watch all InferenceServices in a namespace.

        Args:
            namespace: The namespace to watch
            callback: Callback function(event_type, obj) to handle events
        """
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._watch_namespace_thread,
            args=(namespace, callback),
            daemon=True,
        )
        self._thread.start()
        return self

    def watch_single(self, namespace: str, name: str, callback: Callable):
        """
        Watch a single InferenceService resource.

        Args:
            namespace: The namespace of the resource
            name: The name of the resource
            callback: Callback function(event_type, obj) to handle events
        """
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._watch_single_thread,
            args=(namespace, name, callback),
            daemon=True,
        )
        self._thread.start()
        return self

    def _watch_namespace_thread(self, namespace: str, callback: Callable):
        """Thread function for watching a namespace."""
        thread_id = threading.get_ident()
        log.info(
            f"[Thread {thread_id}] Watcher thread started for namespace: {namespace}"
        )

        # Track state outside the loop so INITIAL is only sent once and the
        # watch stream resumes from the correct resourceVersion after a timeout.
        initial_sent = False
        resource_version = None

        while not self._stop_event.is_set():
            try:
                if self._app:
                    with self._app.test_request_context():
                        gvk = versions.inference_service_gvk()
                        initial_sent, resource_version = self._do_namespace_watch(
                            gvk, namespace, callback, initial_sent, resource_version
                        )
                else:
                    gvk = versions.inference_service_gvk()
                    initial_sent, resource_version = self._do_namespace_watch(
                        gvk, namespace, callback, initial_sent, resource_version
                    )

                if self._stop_event.is_set():
                    log.info(
                        f"[Thread {thread_id}] Stop event detected after watch completion for {namespace}"
                    )
                    break
                else:
                    log.info(
                        f"[Thread {thread_id}] Watch stream ended naturally (timeout), restarting for {namespace}"
                    )

            except Exception as e:
                if self._stop_event.is_set():
                    log.info(
                        f"[Thread {thread_id}] Stop event detected in exception handler for {namespace}"
                    )
                    break
                log.error(
                    f"[Thread {thread_id}] Error in namespace watch for {namespace}: {e}"
                )
                callback("ERROR", {"message": str(e)})
                # Reset state so the next retry does a fresh initial fetch
                initial_sent = False
                resource_version = None
                time.sleep(5)

        log.info(
            f"[Thread {thread_id}] Watcher thread EXITING for namespace: {namespace}"
        )

    def _do_namespace_watch(
        self,
        gvk: dict,
        namespace: str,
        callback: Callable,
        initial_sent: bool,
        resource_version: Optional[str],
    ) -> tuple:
        """Perform one iteration of the namespace watch within request context.

        Sends INITIAL only when initial_sent is False, then streams watch events
        from resource_version. Returns the updated (initial_sent, resource_version)
        so the caller can resume correctly after a stream timeout.
        """
        w = watch.Watch()

        if not initial_sent:
            try:
                log.info(f"Fetching initial list for {namespace} with GVK: {gvk}")
                initial_list = api.list_custom_rsrc(**gvk, namespace=namespace)
                items = initial_list.get("items", [])
                resource_version = initial_list.get("metadata", {}).get(
                    "resourceVersion"
                )
                log.info(
                    f"Successfully fetched {len(items)} items, resourceVersion={resource_version}"
                )
                callback("INITIAL", {"items": items})
                log.info(f"INITIAL callback completed for {namespace}")
                initial_sent = True
            except Exception as e:
                log.error(
                    f"Error fetching initial list for {namespace}: {e}", exc_info=True
                )
                callback("ERROR", {"message": str(e)})
                time.sleep(5)
                return initial_sent, resource_version

        try:
            log.info(
                f"Starting watch stream for {namespace} from resourceVersion={resource_version}"
            )
            for event in w.stream(
                api.custom_api.list_namespaced_custom_object,
                group=gvk["group"],
                version=gvk["version"],
                namespace=namespace,
                plural=gvk["kind"],
                resource_version=resource_version,
                timeout_seconds=60,
            ):
                if self._stop_event.is_set():
                    log.info(f"Stop event set, breaking watch for {namespace}")
                    break

                event_type = event.get("type")
                obj = event.get("object")

                if not event_type or not obj:
                    log.warning(f"Received incomplete event: {event}")
                    continue

                if isinstance(obj, dict):
                    rv = obj.get("metadata", {}).get("resourceVersion")
                    if rv:
                        resource_version = rv
                    try:
                        deployment_mode = utils.get_deployment_mode(obj)
                        obj["deploymentMode"] = deployment_mode
                    except Exception as e:
                        log.warning(f"Error getting deployment mode: {e}")

                callback(event_type, obj)
        finally:
            w.stop()

        return initial_sent, resource_version

    def _watch_single_thread(self, namespace: str, name: str, callback: Callable):
        """Thread function for watching a single resource."""
        # Track state outside the loop so INITIAL is only sent once.
        initial_sent = False
        resource_version = None

        while not self._stop_event.is_set():
            try:
                if self._app:
                    with self._app.test_request_context():
                        gvk = versions.inference_service_gvk()
                        initial_sent, resource_version = self._do_single_watch(
                            gvk,
                            namespace,
                            name,
                            callback,
                            initial_sent,
                            resource_version,
                        )
                else:
                    gvk = versions.inference_service_gvk()
                    initial_sent, resource_version = self._do_single_watch(
                        gvk, namespace, name, callback, initial_sent, resource_version
                    )

                if self._stop_event.is_set():
                    log.info(
                        f"Stop event detected after watch completion for {namespace}/{name}"
                    )
                    break

            except Exception as e:
                if self._stop_event.is_set():
                    break
                log.error(f"Error in single watch for {namespace}/{name}: {e}")
                callback("ERROR", {"message": str(e)})
                # Reset state so the next retry does a fresh initial fetch
                initial_sent = False
                resource_version = None
                time.sleep(5)

    def _do_single_watch(
        self,
        gvk: dict,
        namespace: str,
        name: str,
        callback: Callable,
        initial_sent: bool,
        resource_version: Optional[str],
    ) -> tuple:
        """Perform one iteration of the single-resource watch within request context.

        Sends INITIAL only when initial_sent is False, then streams watch events
        from resource_version. Returns the updated (initial_sent, resource_version).
        """
        w = watch.Watch()

        if not initial_sent:
            try:
                initial_obj = api.get_custom_rsrc(**gvk, namespace=namespace, name=name)
                resource_version = initial_obj.get("metadata", {}).get(
                    "resourceVersion"
                )
                deployment_mode = utils.get_deployment_mode(initial_obj)
                initial_obj["deploymentMode"] = deployment_mode
                callback("INITIAL", initial_obj)
                initial_sent = True
            except Exception as e:
                log.warning(f"Resource {namespace}/{name} not found: {e}")
                callback("ERROR", {"message": f"Resource not found: {str(e)}"})
                time.sleep(5)
                return initial_sent, resource_version

        try:
            field_selector = f"metadata.name={name}"
            for event in w.stream(
                api.custom_api.list_namespaced_custom_object,
                group=gvk["group"],
                version=gvk["version"],
                namespace=namespace,
                plural=gvk["kind"],
                field_selector=field_selector,
                resource_version=resource_version,
                timeout_seconds=60,
            ):
                if self._stop_event.is_set():
                    break

                event_type = event.get("type")
                obj = event.get("object")

                if not event_type or not obj:
                    log.warning(f"Received incomplete event: {event}")
                    continue

                if isinstance(obj, dict):
                    # Track the latest resourceVersion so the stream resumes
                    # from the right point after a timeout.
                    rv = obj.get("metadata", {}).get("resourceVersion")
                    if rv:
                        resource_version = rv
                    try:
                        deployment_mode = utils.get_deployment_mode(obj)
                        obj["deploymentMode"] = deployment_mode
                    except Exception as e:
                        log.warning(f"Error getting deployment mode: {e}")

                callback(event_type, obj)
        finally:
            w.stop()

        return initial_sent, resource_version

    def stop(self):
        """Stop the watcher."""
        log.debug("Setting stop event for watcher")
        self._stop_event.set()
        # Don't wait for thread to join - it will exit on next watch timeout
        # The thread is daemon so it will be cleaned up automatically


class EventWatcher:
    """Watches Kubernetes events for InferenceServices."""

    def __init__(self, app=None):
        """Initialize the event watcher.

        Args:
            app: Flask application instance (for request context in threads)
        """
        self._stop_event = threading.Event()
        self._thread = None
        self._app = app

    def watch_events(self, namespace: str, name: str, callback: Callable):
        """
        Watch events for a specific InferenceService.

        Args:
            namespace: The namespace of the resource
            name: The name of the resource
            callback: Callback function(event_type, obj) to handle events
        """
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._watch_events_thread,
            args=(namespace, name, callback),
            daemon=True,
        )
        self._thread.start()
        return self

    def _watch_events_thread(self, namespace: str, name: str, callback: Callable):
        """Thread function for watching events."""
        v1 = client.CoreV1Api()
        field_selector = f"involvedObject.name={name}"
        initial_sent = False
        resource_version = None

        while not self._stop_event.is_set():
            w = watch.Watch()
            try:
                if not initial_sent:
                    try:
                        initial_events = v1.list_namespaced_event(
                            namespace, field_selector=field_selector
                        )
                        events_list = [
                            api.object_to_dict(event) for event in initial_events.items
                        ]
                        resource_version = initial_events.metadata.resource_version
                        callback("INITIAL", {"items": events_list})
                        initial_sent = True
                    except Exception as e:
                        log.error(
                            f"Error fetching initial events for {namespace}/{name}: {e}"
                        )
                        callback("ERROR", {"message": str(e)})
                        time.sleep(5)
                        continue

                # Watch for new events on the specific resource
                for event in w.stream(
                    v1.list_namespaced_event,
                    namespace=namespace,
                    field_selector=field_selector,
                    resource_version=resource_version,
                    timeout_seconds=60,
                ):
                    if self._stop_event.is_set():
                        break

                    event_type = event.get("type")
                    obj = event.get("object")

                    if not event_type or not obj:
                        log.warning(f"Received incomplete event: {event}")
                        continue

                    try:
                        obj_dict = api.object_to_dict(obj)
                        resource_version = obj_dict.get("metadata", {}).get(
                            "resourceVersion", resource_version
                        )
                        callback(event_type, obj_dict)
                    except Exception as e:
                        log.error(f"Error processing event: {e}")

            except Exception as e:
                if self._stop_event.is_set():
                    break
                log.error(f"Error watching events for {namespace}/{name}: {e}")
                callback("ERROR", {"message": str(e)})
                time.sleep(5)
            finally:
                w.stop()

    def stop(self):
        """Stop the event watcher."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)


class LogWatcher:
    """Watches pod logs for InferenceServices."""

    def __init__(self, app=None):
        """Initialize the log watcher.

        Args:
            app: Flask application instance (for request context in threads)
        """
        self._stop_event = threading.Event()
        self._thread = None
        self._app = app

    def watch_logs(
        self,
        namespace: str,
        name: str,
        components: Optional[List[str]] = None,
        callback: Optional[Callable] = None,
    ):
        """
        Watch logs for an InferenceService.

        Args:
            namespace: The namespace of the resource
            name: The name of the resource
            components: Optional list of components to watch
            callback: Callback function(event_type, obj) to handle log updates
        """
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._watch_logs_thread,
            args=(namespace, name, components, callback),
            daemon=True,
        )
        self._thread.start()
        return self

    def _watch_logs_thread(
        self,
        namespace: str,
        name: str,
        components: Optional[List[str]],
        callback: Optional[Callable],
    ):
        """Thread function for watching logs."""
        components = components or []

        while not self._stop_event.is_set():
            try:
                # Use Flask app and request context if available to call API functions
                if self._app:
                    with self._app.test_request_context():
                        self._fetch_and_stream_logs(
                            namespace, name, components, callback
                        )
                else:
                    self._fetch_and_stream_logs(namespace, name, components, callback)

            except Exception as e:
                if self._stop_event.is_set():
                    break
                log.error(f"Error watching logs for {namespace}/{name}: {e}")
                if callback:
                    callback("ERROR", {"message": str(e)})
                time.sleep(5)

    def _fetch_and_stream_logs(
        self, namespace: str, name: str, components: List[str], callback: Callable
    ):
        """Helper method to fetch and stream logs within request context."""
        # Get the InferenceService
        gvk = versions.inference_service_gvk()
        svc = api.get_custom_rsrc(**gvk, namespace=namespace, name=name)

        deployment_mode = utils.get_deployment_mode(svc)

        if deployment_mode == "ModelMesh":
            component_pods_dict = utils.get_modelmesh_pods(svc, components)
        elif deployment_mode == "Standard":
            component_pods_dict = utils.get_standard_inference_service_pods(
                svc, components
            )
        else:
            component_pods_dict = utils.get_inference_service_pods(svc, components)

        if not component_pods_dict:
            if callback:
                callback("UPDATE", {"logs": {}})
            time.sleep(5)
            return

        logs_response = {}
        for component, pods in component_pods_dict.items():
            if component not in logs_response:
                logs_response[component] = []

            for pod in pods:
                try:
                    logs = api.get_pod_logs(
                        namespace, pod, "kserve-container", auth=False
                    )
                    logs_response[component].append(
                        {"podName": pod, "logs": logs.split("\n")}
                    )
                except Exception as e:
                    log.warning(f"Error getting logs for pod {pod}: {e}")

        if callback:
            callback("UPDATE", {"logs": logs_response})

        # Poll every 3 seconds (matching original behavior)
        time.sleep(3)

    def stop(self):
        """Stop the log watcher."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
