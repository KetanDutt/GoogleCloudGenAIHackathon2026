"""FastAPI composition root. Run from the repository root: uvicorn backend.main:app."""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from backend.api import auth, chat, export, resources
from backend.api.middleware import RequestSafetyMiddleware
from backend.api.openapi import configure_openapi
from backend.config.settings import Settings
from backend.db.database import Database
from backend.models.schemas import SystemStatusResponse
from backend.services.rate_limit import RateLimiter
from backend.services.vertex_client import AIInvalidResponse, AIUnavailable, VertexClient
from backend.services.workflow import Workflow

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    http_logger = logging.getLogger("aiops.http")
    if not http_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        http_logger.addHandler(handler)
    http_logger.setLevel(logging.INFO)
    http_logger.propagate = False
    database = Database(settings)
    vertex = VertexClient(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        from starlette.concurrency import run_in_threadpool

        await run_in_threadpool(database.initialize, settings)
        app.state.ready = True
        try:
            yield
        finally:
            app.state.ready = False
            await run_in_threadpool(vertex.close)
            database.engine.dispose()

    app = FastAPI(
        title="AI Personal Operations Manager",
        version="2.0.0",
        description="A private workspace with review-before-save agent proposals.",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.environment != "production" else None,
    )
    app.state.settings, app.state.database = settings, database
    app.state.vertex, app.state.workflow = vertex, Workflow(vertex)
    app.state.limiter, app.state.ready = RateLimiter(), False
    app.add_middleware(RequestSafetyMiddleware, settings=settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )
    for router in (auth.router, resources.router, chat.router, export.router):
        app.include_router(router, prefix="/api/v1")

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # Pydantic's default error output can include submitted passwords and note content.
        issues = [
            {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Please check the submitted fields.",
                "errors": issues,
                "request_id": request.state.request_id,
            },
        )

    @app.exception_handler(SQLAlchemyError)
    async def storage_error(request: Request, exc: SQLAlchemyError):
        logger.error("storage_failure id=%s type=%s", request.state.request_id, type(exc).__name__)
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Storage is temporarily unavailable. Refresh to check whether your change was saved before retrying.",
                "request_id": request.state.request_id,
            },
        )

    @app.exception_handler(AIUnavailable)
    async def ai_unavailable(request: Request, exc: AIUnavailable):
        return JSONResponse(
            status_code=503,
            content={"detail": str(exc), "request_id": request.state.request_id},
            headers={"Retry-After": "30"},
        )

    @app.exception_handler(AIInvalidResponse)
    async def ai_invalid(request: Request, exc: AIInvalidResponse):
        return JSONResponse(
            status_code=502, content={"detail": str(exc), "request_id": request.state.request_id}
        )

    @app.get("/health", tags=["Operations"])
    def health():
        # Liveness never spends model tokens or runs a BigQuery query.
        return {"status": "ok", "version": "2.0.0"}

    @app.get("/ready", tags=["Operations"])
    def readiness():
        if not app.state.ready:
            return JSONResponse(status_code=503, content={"ready": False})
        try:
            database.check()
        except SQLAlchemyError:
            return JSONResponse(status_code=503, content={"ready": False})
        return {"ready": True}

    @app.get("/api/v1/status", tags=["Operations"], response_model=SystemStatusResponse)
    def system_status():
        return {
            "version": "2.0.0",
            "ai_mode": settings.ai_mode,
            "ai_status": vertex.status,
            "demo_login": settings.allow_demo_login,
            "models": settings.models if settings.ai_mode == "vertex" else [],
            "default_model": settings.default_model,
            "storage": "postgresql" if settings.database_url.startswith("postgresql") else "sqlite",
            "reminder_delivery": "in_app_only",
        }

    configure_openapi(app, settings)
    return app


app = create_app()
