import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn.base")

import os
import logging
import sys
import time
from flask import Flask, g, request
from flask_session.sessions import FileSystemSessionInterface
from flask_cors import CORS
from routes.main_routes import bp as main_bp
from services.session_state import init_session_state


LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger(__name__)
logging.getLogger("werkzeug").addFilter(
    lambda record: not any(
        path in record.getMessage() for path in ("GET /status ", "GET /upload/progress/")
    )
)


class UploadProgressSessionInterface(FileSystemSessionInterface):
    def save_session(self, app, session, response):
        # Flask-Session 0.5 otherwise writes the session snapshot even on reads.
        if request.endpoint != "main.get_upload_progress":
            super().save_session(app, session, response)


def create_app():
    warnings.filterwarnings("ignore", category=UserWarning, module="sklearn.base")

    app = Flask(__name__)

    # --------------------------------------------------------------
    # CORS
    # --------------------------------------------------------------
    cors_origins = [
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS",
            "http://localhost:5173",
        ).split(",")
        if origin.strip()
    ]

    CORS(
        app,
        resources={r"/*": {"origins": cors_origins}},
        supports_credentials=True,
    )

    # --------------------------------------------------------------
    # Server-side Flask sessions
    # --------------------------------------------------------------
    secret_key = os.environ.get("SECRET_KEY")

    if not secret_key:
        raise RuntimeError(
            "Missing SECRET_KEY environment variable. "
            "Set a long random value before starting the backend."
        )

    app.config.update(
        SECRET_KEY=secret_key,
        SESSION_TYPE="filesystem",
        SESSION_FILE_DIR=os.environ.get(
            "SESSION_FILE_DIR",
            os.path.join(os.getcwd(), "Session_Flask"),
        ),
        SESSION_PERMANENT=False,
        SESSION_USE_SIGNER=False,   
        SESSION_COOKIE_NAME="my_session",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE=os.environ.get(
            "SESSION_COOKIE_SAMESITE",
            "Lax",
        ),
        SESSION_COOKIE_SECURE=(
            os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
        ),
    )
    

    os.makedirs(app.config["SESSION_FILE_DIR"], mode=0o700, exist_ok=True)

    app.session_interface = UploadProgressSessionInterface(
        cache_dir=app.config["SESSION_FILE_DIR"],
        threshold=app.config.get("SESSION_FILE_THRESHOLD", 500),
        mode=app.config.get("SESSION_FILE_MODE", 0o600),
        key_prefix=app.config.get("SESSION_KEY_PREFIX", "session:"),
        use_signer=app.config["SESSION_USE_SIGNER"],
        permanent=app.config["SESSION_PERMANENT"],
    )

    # --------------------------------------------------------------
    # Routes
    # --------------------------------------------------------------
    app.register_blueprint(main_bp)

    @app.before_request
    def before_request():
        g.request_started_at = time.perf_counter()
        if request.endpoint == "main.get_upload_progress":
            return
        init_session_state()
        if request.path != "/status":
            logger.info("request.start method=%s path=%s", request.method, request.path)

    @app.after_request
    def after_request(response):
        if request.path != "/status" and request.endpoint != "main.get_upload_progress":
            elapsed_ms = (time.perf_counter() - getattr(g, "request_started_at", time.perf_counter())) * 1000
            logger.info(
                "request.end method=%s path=%s status=%s elapsed_ms=%.1f",
                request.method,
                request.path,
                response.status_code,
                elapsed_ms,
            )
        return response

    @app.teardown_request
    def teardown_request(exc):
        if exc is not None:
            logger.error(
                "request.error method=%s path=%s",
                request.method,
                request.path,
                exc_info=(type(exc), exc, exc.__traceback__),
            )

    logger.info("Flask is ready. LLM model loading is lazy and starts only when an LLM option is used.")

    return app


if __name__ == "__main__":
    app = create_app()

    app.run(
        debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true",
        host=os.environ.get("FLASK_RUN_HOST", "0.0.0.0"),
        port=int(os.environ.get("FLASK_RUN_PORT", "5000")),
    )
