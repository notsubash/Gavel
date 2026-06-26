"""Run lifecycle routes."""

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from api.deps import build_idea_preview, get_app_settings
from api.run_manager import RunManager, get_run_manager
from api.schemas import CreateRunRequest, RunCreatedResponse, RunStatusResponse
from config import Settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["runs"])

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _format_sse(envelope) -> str:
    return f"data: {json.dumps(envelope.model_dump(mode='json'))}\n\n"


@router.post("/runs", response_model=RunCreatedResponse)
def create_run(
    request: CreateRunRequest,
    manager: Annotated[RunManager, Depends(get_run_manager)],
) -> RunCreatedResponse:
    record = manager.create(request)
    return RunCreatedResponse(run_id=record.run_id)


@router.get("/runs/{run_id}", response_model=RunStatusResponse)
def get_run_status(
    run_id: str,
    manager: Annotated[RunManager, Depends(get_run_manager)],
) -> RunStatusResponse:
    record = manager.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return RunStatusResponse(
        run_id=record.run_id,
        status=record.status,
        idea_preview=build_idea_preview(record.request.idea),
        created_at=record.created_at,
    )


@router.get("/runs/{run_id}/events")
async def stream_run_events(
    run_id: str,
    manager: Annotated[RunManager, Depends(get_run_manager)],
    settings: Annotated[Settings, Depends(get_app_settings)],
):
    if manager.get(run_id) is None:
        raise HTTPException(status_code=404, detail="Run not found")

    # Subscriber model: the engine runs once into a buffer; every connection
    # (including reconnects and extra tabs) just replays + tails that buffer.
    manager.ensure_started(run_id, settings)

    async def generate():
        async for envelope in manager.subscribe(run_id):
            yield _format_sse(envelope)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
