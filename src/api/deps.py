"""Shared FastAPI dependencies and run helpers."""

from dataclasses import dataclass, field
from datetime import UTC, datetime
import logging
import os

from api import workspace_store
from api.schemas import CreateRunRequest
from config import Settings, get_settings
from idea_context import idea_display_summary
from modeling import build_chat_model
from research.service import (
    ResearchContext,
    TavilyHttpClient,
    build_research_context,
    decide_web_search_usage,
)
from validation.compose import build_judge_context
from validation.versioning import build_change_summary, compute_worksheet_diff

logger = logging.getLogger(__name__)


@dataclass
class RunRecord:
    run_id: str
    request: CreateRunRequest
    status: str = "created"
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class RunWorkspaceContext:
    workspace_id: str
    worksheet_version_id: str
    working_name: str
    idea_text: str
    judge_context: str


def get_app_settings() -> Settings:
    return get_settings()


def get_cors_origins() -> list[str]:
    raw = os.getenv(
        "ROAST_CORS_ORIGINS",
        # ponytail: Next falls over to 3001 when 3000 is taken
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def build_idea_preview(idea: str, *, max_length: int = 120) -> str:
    return idea_display_summary(idea, max_chars=max_length)


def load_run_workspace_context(run_id: str, request: CreateRunRequest) -> RunWorkspaceContext:
    store = workspace_store.get_workspace_store()
    version_id = request.worksheet_version_id
    if version_id is None:
        link = store.get_run_link(run_id)
        if link:
            version_id = link[1]
        else:
            workspace = store.get_workspace(request.workspace_id)
            if workspace is None:
                raise ValueError(f"workspace {request.workspace_id!r} not found")
            version_id = workspace.current_version_id
    if version_id is None:
        raise ValueError(f"run {run_id!r} has no worksheet version")

    version = store.get_version(version_id)
    if version is None or version.workspace_id != request.workspace_id:
        raise ValueError(f"worksheet version {version_id!r} not found for workspace")

    assumptions = store.list_assumptions(request.workspace_id)
    evidence = store.list_evidence(request.workspace_id)

    changes = "First roast for this workspace."
    prior_run_version_id = store.get_last_run_version_id(
        request.workspace_id, exclude_run_id=run_id
    )
    if prior_run_version_id and prior_run_version_id != version.id:
        prior = store.get_version(prior_run_version_id)
        if prior is not None:
            diff = compute_worksheet_diff(prior.worksheet, version.worksheet)
            changes = build_change_summary(diff)

    judge_context = build_judge_context(
        version.worksheet,
        assumptions,
        evidence,
        changes_since_last_run=changes,
    )
    return RunWorkspaceContext(
        workspace_id=request.workspace_id,
        worksheet_version_id=version.id,
        working_name=version.worksheet.working_name,
        idea_text=version.generated_document,
        judge_context=judge_context,
    )


def build_startup_idea_context(run_id: str, request: CreateRunRequest) -> str:
    return load_run_workspace_context(run_id, request).judge_context


def build_model_for_run(request: CreateRunRequest, settings: Settings):
    return build_chat_model(
        request.model_runtime,
        settings,
        os.getenv("DEEPSEEK_API_KEY"),
    )


def build_research_context_for_run(
    request: CreateRunRequest,
    startup_idea: str,
    settings: Settings,
    model,
) -> ResearchContext | None:
    if not request.enable_web_search:
        return None

    tavily_key = os.getenv("TAVILY_API_KEY")
    if not tavily_key:
        return None

    try:
        search_decision = decide_web_search_usage(
            policy_model=model,
            startup_idea=startup_idea,
        )
        if not search_decision.use_search:
            return None

        return build_research_context(
            startup_idea=startup_idea,
            tavily_client=TavilyHttpClient(tavily_key),
            max_results=settings.web_search_max_results,
            enabled=True,
            decision=search_decision,
        )
    except Exception as exc:
        logger.warning("Web research skipped for API run: %s", exc)
        return None


_idea_store = None


def get_idea_store():
    from memory.factory import build_idea_store
    from memory.identity import get_local_user_id

    global _idea_store
    if _idea_store is None:
        _idea_store = build_idea_store()
        get_local_user_id(_idea_store)
    return _idea_store
