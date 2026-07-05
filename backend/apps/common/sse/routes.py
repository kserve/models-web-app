"""SSE route handlers for real-time updates."""

import json
from queue import Queue, Empty, Full
from flask import Blueprint, Response, request

from kubeflow.kubeflow.crud_backend import authz, logging
from .. import versions
from .watchers import InferenceServiceWatcher, EventWatcher, LogWatcher

log = logging.getLogger(__name__)

bp = Blueprint("sse", __name__)


def _authorize_inference_service_stream(namespace, *verbs):
    gvk = versions.inference_service_gvk()
    for verb in verbs:
        authz.ensure_authorized(
            verb,
            gvk["group"],
            gvk["version"],
            gvk["kind"],
            namespace,
        )


def _authorize_events_stream(namespace):
    for verb in ("list", "watch"):
        authz.ensure_authorized(verb, "", "v1", "events", namespace)


def event_stream(client_queue, timeout=5):
    """
    Generator function for SSE event stream.

    Args:
        client_queue: Queue to receive events from
        timeout: Timeout for queue polling (seconds)
    """
    try:
        while True:
            try:
                message = client_queue.get(timeout=timeout)
                yield message
            except Empty:
                yield ": heartbeat\n\n"
    except GeneratorExit:
        pass


@bp.route("/api/sse/namespaces/<namespace>/inferenceservices")
def stream_inference_services(namespace):
    """
    Stream InferenceService updates for a namespace.

    Args:
        namespace: The namespace to watch
    """
    from . import sse_manager
    from flask import current_app

    _authorize_inference_service_stream(namespace, "list", "watch")
    client_queue = Queue(maxsize=500)

    def watcher_factory(ns, callback):
        watcher = InferenceServiceWatcher(app=current_app._get_current_object())
        return watcher.watch_namespace(ns, callback)

    sse_manager.register_namespace_watch(namespace, client_queue, watcher_factory)

    def generate():
        try:
            for event in event_stream(client_queue):
                yield event
        finally:
            sse_manager.unregister_namespace_watch(namespace, client_queue)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@bp.route("/api/sse/namespaces/<namespace>/inferenceservices/<name>")
def stream_inference_service(namespace, name):
    """
    Stream updates for a single InferenceService.

    Args:
        namespace: The namespace of the resource
        name: The name of the resource
    """
    from . import sse_manager
    from flask import current_app

    _authorize_inference_service_stream(namespace, "get", "watch")
    client_queue = Queue(maxsize=500)

    def watcher_factory(ns, nm, callback):
        watcher = InferenceServiceWatcher(app=current_app._get_current_object())
        return watcher.watch_single(ns, nm, callback)

    sse_manager.register_single_watch(namespace, name, client_queue, watcher_factory)

    def generate():
        try:
            for event in event_stream(client_queue):
                yield event
        finally:
            sse_manager.unregister_single_watch(namespace, name, client_queue)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@bp.route("/api/sse/namespaces/<namespace>/inferenceservices/<name>/events")
def stream_events(namespace, name):
    """
    Stream Kubernetes events for an InferenceService.

    Args:
        namespace: The namespace of the resource
        name: The name of the resource
    """
    from flask import current_app

    _authorize_events_stream(namespace)
    client_queue = Queue(maxsize=500)

    def callback(event_type, obj):
        try:
            event_data = {
                "type": event_type,
                "object": obj if "items" not in obj else None,
                "items": obj.get("items") if "items" in obj else None,
            }
            message = f"data: {json.dumps(event_data)}\n\n"
            client_queue.put_nowait(message)
        except Full:
            log.warning(f"Client queue full, dropping event type={event_type}")
        except Exception as e:
            log.error(f"Error sending event: {e}")

    watcher = EventWatcher(app=current_app._get_current_object())
    watcher.watch_events(namespace, name, callback)

    def generate():
        try:
            for event in event_stream(client_queue):
                yield event
        finally:
            watcher.stop()

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@bp.route("/api/sse/namespaces/<namespace>/inferenceservices/<name>/logs")
def stream_logs(namespace, name):
    """
    Stream logs for an InferenceService.

    Args:
        namespace: The namespace of the resource
        name: The name of the resource
    """
    from flask import current_app

    _authorize_inference_service_stream(namespace, "get")
    client_queue = Queue(maxsize=500)
    components = request.args.getlist("component")

    # Validate component list to prevent abuse
    if len(components) > 10:
        return Response(
            json.dumps({"error": "Too many components requested (max 10)"}),
            status=400,
            mimetype="application/json",
        )

    def callback(event_type, obj):
        try:
            event_data = {
                "type": event_type,
                "logs": obj.get("logs") if "logs" in obj else None,
                "message": obj.get("message") if "message" in obj else None,
            }
            message = f"data: {json.dumps(event_data)}\n\n"
            client_queue.put_nowait(message)
        except Full:
            log.warning(f"Client queue full, dropping log event type={event_type}")
        except Exception as e:
            log.error(f"Error sending log event: {e}")

    watcher = LogWatcher(app=current_app._get_current_object())
    watcher.watch_logs(namespace, name, components, callback)

    def generate():
        try:
            for event in event_stream(client_queue):
                yield event
        finally:
            watcher.stop()

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
