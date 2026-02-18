"""Server-Sent Events (SSE) module for real-time updates."""

from .manager import SSEConnectionManager

# Global SSE connection manager instance - define before importing routes to avoid circular imports
sse_manager = SSEConnectionManager()

# Import routes after sse_manager is defined
from .routes import bp as sse_bp

__all__ = ["sse_bp", "sse_manager"]
