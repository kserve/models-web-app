"""Include routes of the app."""
from flask import Blueprint

bp = Blueprint("default_routes", __name__)

from . import post, put  # noqa: F401, E402
