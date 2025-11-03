"""Package with the base code between backend versions."""

import kubeflow.kubeflow.crud_backend as base
from kubeflow.kubeflow.crud_backend import config, logging

from .routes import bp as routes_bp

log = logging.getLogger(__name__)


def create_app(
    name=__name__, static_folder="static", configuration: config.Config = None
):
    """Create the WSGI app."""
    configuration = config.Config() if configuration is None else configuration

    app = base.create_app(name, static_folder, configuration)

    # Register the app's blueprints
    app.register_blueprint(routes_bp)

    return app
