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

    def __init__(self):
        """Initialize the watcher."""
        self._stop_event = threading.Event()
        self._thread = None

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
        gvk = versions.inference_service_gvk()
        w = watch.Watch()

        while not self._stop_event.is_set():
            try:
                # Get initial list
                try:
                    initial_list = api.list_custom_rsrc(**gvk, namespace=namespace)
                    callback("INITIAL", initial_list)
                except Exception as e:
                    log.error(f"Error fetching initial list for {namespace}: {e}")
                    callback("ERROR", {"message": str(e)})
                    time.sleep(5)
                    continue

                # Start watching for changes
                for event in w.stream(
                    api.list_custom_rsrc,
                    **gvk,
                    namespace=namespace,
                    timeout_seconds=60,
                ):
                    if self._stop_event.is_set():
                        break

                    event_type = event.get("type")
                    obj = event.get("object")

                    if not event_type or not obj:
                        log.warning(f"Received incomplete event: {event}")
                        continue

                    # Add deployment mode information
                    if isinstance(obj, dict):
                        try:
                            deployment_mode = utils.get_deployment_mode(obj)
                            obj["deploymentMode"] = deployment_mode
                        except Exception as e:
                            log.warning(f"Error getting deployment mode: {e}")

                    callback(event_type, obj)

            except Exception as e:
                if self._stop_event.is_set():
                    break
                log.error(f"Error in namespace watch for {namespace}: {e}")
                callback("ERROR", {"message": str(e)})
                time.sleep(5)  # Wait before retrying

        w.stop()

    def _watch_single_thread(self, namespace: str, name: str, callback: Callable):
        """Thread function for watching a single resource."""
        gvk = versions.inference_service_gvk()
        w = watch.Watch()

        while not self._stop_event.is_set():
            try:
                # Get initial resource
                try:
                    initial_obj = api.get_custom_rsrc(
                        **gvk, namespace=namespace, name=name
                    )
                    deployment_mode = utils.get_deployment_mode(initial_obj)
                    initial_obj["deploymentMode"] = deployment_mode
                    callback("INITIAL", initial_obj)
                except Exception as e:
                    log.warning(f"Resource {namespace}/{name} not found: {e}")
                    callback("ERROR", {"message": f"Resource not found: {str(e)}"})
                    time.sleep(5)
                    continue

                # Watch for changes to this specific resource
                field_selector = f"metadata.name={name}"
                for event in w.stream(
                    api.list_custom_rsrc,
                    **gvk,
                    namespace=namespace,
                    field_selector=field_selector,
                    timeout_seconds=60,
                ):
                    if self._stop_event.is_set():
                        break

                    event_type = event.get("type")
                    obj = event.get("object")

                    if not event_type or not obj:
                        log.warning(f"Received incomplete event: {event}")
                        continue

                    # Add deployment mode information
                    if isinstance(obj, dict):
                        try:
                            deployment_mode = utils.get_deployment_mode(obj)
                            obj["deploymentMode"] = deployment_mode
                        except Exception as e:
                            log.warning(f"Error getting deployment mode: {e}")

                    callback(event_type, obj)

            except Exception as e:
                if self._stop_event.is_set():
                    break
                log.error(f"Error in single watch for {namespace}/{name}: {e}")
                callback("ERROR", {"message": str(e)})
                time.sleep(5)  # Wait before retrying

        w.stop()

    def stop(self):
        """Stop the watcher."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)


class EventWatcher:
    """Watches Kubernetes events for InferenceServices."""

    def __init__(self):
        """Initialize the event watcher."""
        self._stop_event = threading.Event()
        self._thread = None

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
        w = watch.Watch()

        while not self._stop_event.is_set():
            try:
                # Get initial events
                field_selector = f"involvedObject.name={name}"
                try:
                    initial_events = v1.list_namespaced_event(
                        namespace, field_selector=field_selector
                    )
                    events_list = [
                        api.object_to_dict(event) for event in initial_events.items
                    ]
                    callback("INITIAL", {"items": events_list})
                except Exception as e:
                    log.error(
                        f"Error fetching initial events for {namespace}/{name}: {e}"
                    )
                    callback("ERROR", {"message": str(e)})
                    time.sleep(5)
                    continue

                # Watch for new events
                for event in w.stream(
                    v1.list_namespaced_event,
                    namespace=namespace,
                    field_selector=field_selector,
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
                        callback(event_type, api.object_to_dict(obj))
                    except Exception as e:
                        log.error(f"Error processing event: {e}")

            except Exception as e:
                if self._stop_event.is_set():
                    break
                log.error(f"Error watching events for {namespace}/{name}: {e}")
                callback("ERROR", {"message": str(e)})
                time.sleep(5)

        w.stop()

    def stop(self):
        """Stop the event watcher."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)


class LogWatcher:
    """Watches pod logs for InferenceServices."""

    def __init__(self):
        """Initialize the log watcher."""
        self._stop_event = threading.Event()
        self._thread = None

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
                # Get the InferenceService
                gvk = versions.inference_service_gvk()
                svc = api.get_custom_rsrc(**gvk, namespace=namespace, name=name)

                # Get deployment mode
                deployment_mode = utils.get_deployment_mode(svc)

                # Get component pods based on deployment mode
                if deployment_mode == "ModelMesh":
                    component_pods_dict = utils.get_modelmesh_pods(svc, components)
                elif deployment_mode == "Standard":
                    component_pods_dict = utils.get_standard_inference_service_pods(
                        svc, components
                    )
                else:
                    component_pods_dict = utils.get_inference_service_pods(
                        svc, components
                    )

                if not component_pods_dict:
                    if callback:
                        callback("UPDATE", {"logs": {}})
                    time.sleep(5)
                    continue

                # Collect logs from all pods
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

            except Exception as e:
                if self._stop_event.is_set():
                    break
                log.error(f"Error watching logs for {namespace}/{name}: {e}")
                if callback:
                    callback("ERROR", {"message": str(e)})
                time.sleep(5)

    def stop(self):
        """Stop the log watcher."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
