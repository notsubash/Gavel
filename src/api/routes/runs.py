"""Run lifecycle routes."""

import asyncio
import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from api.deps import build_idea_preview, get_app_settings, load_run_workspace_context
from api.run_manager import RunManager, get_run_manager
from api.schemas import (
    ApiEventEnvelope,
    AppealJudgeOutcomeResponse,
    AppealRequest,
    AppealResponse,
    CreateRunRequest,
    ExperimentContextResponse,
    RunCreatedResponse,
    RunHandoffResponse,
    RunListItem,
    RunListResponse,
    RunPanelResponse,
    RunStatusResponse,
    SimilarRunsResponse,
)
from config import Settings
from judges.confidence import confidence_before_after

logger = logging.getLogger(__name__)

router = APIRouter(tags=["runs"])

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}

SSE_HEARTBEAT_FRAME = ": keep-alive\n\n"


def _parse_last_event_id(request: Request) -> int:
    raw = request.headers.get("Last-Event-ID")
    if not raw:
        return -1
    try:
        value = int(raw.strip())
    except ValueError:
        logger.debug("Invalid Last-Event-ID %r, replaying from start", raw)
        return -1
    if value < 0:
        logger.debug("Negative Last-Event-ID %r, replaying from start", raw)
        return -1
    return value


def _format_sse(envelope: ApiEventEnvelope) -> str:
    payload = json.dumps(envelope.model_dump(mode="json"))
    return f"id: {envelope.sequence}\ndata: {payload}\n\n"


def _run_status_response(record) -> RunStatusResponse:
    try:
        ctx = load_run_workspace_context(record.run_id, record.request)
        idea = ctx.idea_text
        workspace_id = ctx.workspace_id
        worksheet_version_id = ctx.worksheet_version_id
        working_name = ctx.working_name
    except ValueError:
        idea = ""
        workspace_id = record.request.workspace_id
        worksheet_version_id = record.request.worksheet_version_id
        working_name = None

    return RunStatusResponse(
        run_id=record.run_id,
        status=record.status,
        idea=idea,
        idea_preview=build_idea_preview(idea or working_name or "Untitled"),
        created_at=record.created_at,
        workspace_id=workspace_id,
        worksheet_version_id=worksheet_version_id,
        working_name=working_name,
        parent_run_id=record.request.parent_run_id,
        version=record.request.version,
    )


def _run_list_item(record, summary) -> RunListItem:
    try:
        ctx = load_run_workspace_context(record.run_id, record.request)
        preview = build_idea_preview(ctx.working_name or ctx.idea_text)
        workspace_id = ctx.workspace_id
        worksheet_version_id = ctx.worksheet_version_id
    except ValueError:
        preview = "Untitled"
        workspace_id = record.request.workspace_id
        worksheet_version_id = record.request.worksheet_version_id

    return RunListItem(
        run_id=record.run_id,
        status=record.status,
        idea_preview=preview,
        created_at=record.created_at,
        workspace_id=workspace_id,
        worksheet_version_id=worksheet_version_id,
        verdict_summary=summary,
        parent_run_id=record.request.parent_run_id,
        version=record.request.version,
    )


@router.post("/runs", response_model=RunCreatedResponse)
def create_run(
    request: CreateRunRequest,
    manager: Annotated[RunManager, Depends(get_run_manager)],
) -> RunCreatedResponse:
    try:
        record = manager.create(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return RunCreatedResponse(run_id=record.run_id)


@router.get("/runs", response_model=RunListResponse)
def list_runs(
    manager: Annotated[RunManager, Depends(get_run_manager)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    limit: int | None = None,
    offset: int = 0,
) -> RunListResponse:
    resolved_limit = settings.list_runs_default_limit if limit is None else limit
    if resolved_limit < 1 or resolved_limit > settings.list_runs_max_limit:
        raise HTTPException(
            status_code=422,
            detail=f"limit must be between 1 and {settings.list_runs_max_limit}",
        )
    if offset < 0:
        raise HTTPException(status_code=422, detail="offset must be >= 0")

    items, total = manager.list_runs(limit=resolved_limit, offset=offset)
    return RunListResponse(
        runs=[_run_list_item(record, summary) for record, summary in items],
        total=total,
        limit=resolved_limit,
        offset=offset,
    )


@router.get("/runs/{run_id}/handoff", response_model=RunHandoffResponse)
def get_run_handoff(
    run_id: str,
    manager: Annotated[RunManager, Depends(get_run_manager)],
) -> RunHandoffResponse:
    from api import workspace_store

    record = manager.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    stored = workspace_store.get_workspace_store().get_run_handoff(run_id)
    if stored is None:
        return RunHandoffResponse(
            run_id=run_id,
            workspace_id=record.request.workspace_id,
            items=[],
        )
    workspace_id, items = stored
    return RunHandoffResponse(run_id=run_id, workspace_id=workspace_id, items=items)


@router.get("/runs/{run_id}/similar", response_model=SimilarRunsResponse)
def list_similar_runs(
    run_id: str,
    manager: Annotated[RunManager, Depends(get_run_manager)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    limit: int | None = None,
) -> SimilarRunsResponse:
    resolved_limit = 3 if limit is None else limit
    if resolved_limit < 1 or resolved_limit > 10:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 10")
    try:
        items = manager.list_similar_runs(run_id, limit=resolved_limit)
    except KeyError:
        raise HTTPException(status_code=404, detail="Run not found") from None
    return SimilarRunsResponse(runs=items)


@router.get("/runs/{run_id}/panel", response_model=RunPanelResponse)
def get_run_panel(
    run_id: str,
    manager: Annotated[RunManager, Depends(get_run_manager)],
) -> RunPanelResponse:
    record = manager.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    panel = manager.get_effective_panel(run_id)
    if panel is None:
        raise HTTPException(status_code=409, detail="Run has no completed panel yet")
    verdicts = panel.get("verdicts")
    if not isinstance(verdicts, list):
        raise HTTPException(status_code=409, detail="Run has no completed panel yet")
    return RunPanelResponse(
        verdicts=verdicts,
        confidence_snapshot=manager.get_confidence_snapshot(run_id),
    )


@router.get("/runs/{run_id}", response_model=RunStatusResponse)
def get_run_status(
    run_id: str,
    manager: Annotated[RunManager, Depends(get_run_manager)],
) -> RunStatusResponse:
    record = manager.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_status_response(record)


@router.post("/runs/{run_id}/cancel", response_model=RunStatusResponse)
def cancel_run(
    run_id: str,
    manager: Annotated[RunManager, Depends(get_run_manager)],
) -> RunStatusResponse:
    record = manager.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    try:
        record = manager.cancel(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _run_status_response(record)


@router.post("/runs/{run_id}/appeal", response_model=AppealResponse)
async def appeal_run(
    run_id: str,
    body: AppealRequest,
    manager: Annotated[RunManager, Depends(get_run_manager)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> AppealResponse:
    try:
        original_panel, result = await manager.appeal(
            run_id,
            body.appeal_text,
            settings,
            body.target_judges,
            body.experiment_context.model_dump(mode="json") if body.experiment_context else None,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Run not found") from None
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    outcomes = result.evidence_outcomes
    movement = confidence_before_after(
        manager.get_debate_result(run_id),
        result.revised_structured_synthesis,
        original_verdicts=original_panel.verdicts,
        revised_verdicts=result.revised_panel.verdicts,
    )

    experiment_response: ExperimentContextResponse | None = None
    if body.experiment_context is not None:
        ctx = body.experiment_context
        experiment_response = ExperimentContextResponse(
            experiment_id=ctx.experiment_id,
            status="reviewed",
            changed_assumption=ctx.changed_assumption,
            artifact_links=list(ctx.artifact_links or []),
        )

    return AppealResponse(
        appeal_text=body.appeal_text.strip(),
        original_panel=original_panel.model_dump(mode="json"),
        revised_panel=result.revised_panel.model_dump(mode="json"),
        revised_synthesis=result.revised_synthesis,
        revised_structured_synthesis=result.revised_structured_synthesis,
        confidence_before_after=movement,
        experiment_context=experiment_response,
        target_judges=list(result.target_judges),
        evidence_outcomes=[
            AppealJudgeOutcomeResponse(
                judge=item.judge,
                evidence_ask=item.evidence_ask,
                outcome=item.outcome,
                targeted=item.targeted,
                score_delta=item.score_delta,
            )
            for item in outcomes
        ],
    )


@router.get("/runs/{run_id}/events")
async def stream_run_events(
    run_id: str,
    request: Request,
    manager: Annotated[RunManager, Depends(get_run_manager)],
    settings: Annotated[Settings, Depends(get_app_settings)],
):
    if manager.get(run_id) is None:
        raise HTTPException(status_code=404, detail="Run not found")

    manager.ensure_started(run_id, settings)
    after_sequence = _parse_last_event_id(request)

    async def generate():
        stream = manager.subscribe(run_id, after_sequence=after_sequence)
        iterator = stream.__aiter__()
        while True:
            try:
                envelope = await asyncio.wait_for(
                    iterator.__anext__(), timeout=settings.sse_heartbeat_seconds
                )
                yield _format_sse(envelope)
            except TimeoutError:
                yield SSE_HEARTBEAT_FRAME
            except StopAsyncIteration:
                return

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
