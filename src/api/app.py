"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.deps import get_cors_origins
from api.routes.runs import router as runs_router
from api.run_manager import RunManager, get_run_manager


def create_app(*, manager: RunManager | None = None) -> FastAPI:
    app = FastAPI(title="Roast Arena API", version="0.1.0")

    if manager is not None:
        app.state.run_manager = manager
        app.dependency_overrides[get_run_manager] = lambda: manager

    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(runs_router, prefix="/api")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
