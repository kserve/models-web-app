"""Server-Sent Events (SSE) module for real-time updates."""

from .manager import SSEConnectionManager

sse_manager = SSEConnectionManager()

from .routes import bp as sse_bp

__all__ = ["sse_bp", "sse_manager"]
