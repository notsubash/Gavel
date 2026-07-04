"""Workspace and worksheet API routes."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from api.workspace_store import WorkspaceStore, get_workspace_store
from validation.llm.assumptions import extract_assumptions
from validation.llm.clarify import clarify_field
from validation.llm.draft import draft_from_notes
from validation.schemas import (
    ClarifyFieldRequest,
    ClarifyFieldResponse,
    CreateWorkspaceRequest,
    DraftFromNotesRequest,
    DraftFromNotesResponse,
    ExtractAssumptionsResponse,
    PersistAssumptionsRequest,
    UpdateWorkspaceRequest,
    WorksheetVersion,
    WorkspaceDetailResponse,
    WorkspaceListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _detail(store: WorkspaceStore, workspace_id: str) -> WorkspaceDetailResponse:
    workspace = store.get_workspace(workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    version = store.get_current_version(workspace_id)
    if version is None:
        raise HTTPException(status_code=404, detail="worksheet version not found")
    assumptions = store.list_assumptions(workspace_id)
    return WorkspaceDetailResponse(
        workspace=workspace,
        current_version=version,
        assumptions=assumptions,
    )


@router.post("", response_model=WorkspaceDetailResponse, status_code=201)
def create_workspace(
    body: CreateWorkspaceRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> WorkspaceDetailResponse:
    workspace, version, _assumption = store.create_workspace(body.worksheet)
    return WorkspaceDetailResponse(
        workspace=workspace,
        current_version=version,
        assumptions=store.list_assumptions(workspace.id),
    )


@router.get("", response_model=WorkspaceListResponse)
def list_workspaces(
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
    limit: int | None = None,
    offset: int = 0,
) -> WorkspaceListResponse:
    resolved_limit = limit if limit is not None else 20
    if resolved_limit < 1 or resolved_limit > 100:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
    if offset < 0:
        raise HTTPException(status_code=422, detail="offset must be >= 0")

    items, total = store.list_workspaces(limit=resolved_limit, offset=offset)
    return WorkspaceListResponse(
        workspaces=items,
        total=total,
        limit=resolved_limit,
        offset=offset,
    )


@router.get("/{workspace_id}", response_model=WorkspaceDetailResponse)
def get_workspace(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> WorkspaceDetailResponse:
    return _detail(store, workspace_id)


@router.patch("/{workspace_id}", response_model=WorkspaceDetailResponse)
def update_workspace(
    workspace_id: str,
    body: UpdateWorkspaceRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> WorkspaceDetailResponse:
    if body.lifecycle is not None:
        updated = store.update_lifecycle(workspace_id, body.lifecycle)
        if updated is None:
            raise HTTPException(status_code=404, detail="workspace not found")
    return _detail(store, workspace_id)


@router.get("/{workspace_id}/versions", response_model=list[WorksheetVersion])
def list_versions(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> list[WorksheetVersion]:
    """Phase 1 stub: returns current version only. Full history ships in Phase 3."""
    workspace = store.get_workspace(workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    version = store.get_current_version(workspace_id)
    return [version] if version else []


@router.post("/draft-from-notes", response_model=DraftFromNotesResponse)
def assist_draft_from_notes_new(body: DraftFromNotesRequest) -> DraftFromNotesResponse:
    """Draft worksheet from notes before workspace is created."""
    try:
        worksheet, ai_fields = draft_from_notes(body.notes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("draft-from-notes failed")
        raise HTTPException(status_code=503, detail="AI draft unavailable") from exc
    return DraftFromNotesResponse(worksheet=worksheet, ai_drafted_fields=ai_fields)


@router.post("/clarify-field", response_model=ClarifyFieldResponse)
def assist_clarify_field_new(body: ClarifyFieldRequest) -> ClarifyFieldResponse:
    """Clarify a field before workspace is created."""
    try:
        clarified = clarify_field(body.field_name, body.current_value, body.worksheet_context)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("clarify-field failed")
        raise HTTPException(status_code=503, detail="AI clarify unavailable") from exc
    return ClarifyFieldResponse(field_name=body.field_name, clarified_value=clarified)


@router.post("/{workspace_id}/assist/draft-from-notes", response_model=DraftFromNotesResponse)
def assist_draft_from_notes(
    workspace_id: str,
    body: DraftFromNotesRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> DraftFromNotesResponse:
    if store.get_workspace(workspace_id) is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    try:
        worksheet, ai_fields = draft_from_notes(body.notes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("draft-from-notes failed")
        raise HTTPException(status_code=503, detail="AI draft unavailable") from exc
    return DraftFromNotesResponse(worksheet=worksheet, ai_drafted_fields=ai_fields)


@router.post("/{workspace_id}/assist/clarify-field", response_model=ClarifyFieldResponse)
def assist_clarify_field(
    workspace_id: str,
    body: ClarifyFieldRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ClarifyFieldResponse:
    if store.get_workspace(workspace_id) is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    try:
        clarified = clarify_field(body.field_name, body.current_value, body.worksheet_context)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("clarify-field failed")
        raise HTTPException(status_code=503, detail="AI clarify unavailable") from exc
    return ClarifyFieldResponse(field_name=body.field_name, clarified_value=clarified)


@router.post(
    "/{workspace_id}/assist/extract-assumptions", response_model=ExtractAssumptionsResponse
)
def assist_extract_assumptions(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ExtractAssumptionsResponse:
    workspace = store.get_workspace(workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    version = store.get_current_version(workspace_id)
    if version is None:
        raise HTTPException(status_code=404, detail="worksheet version not found")
    try:
        assumptions = extract_assumptions(version.worksheet, workspace_id)
    except Exception as exc:
        logger.exception("extract-assumptions failed")
        raise HTTPException(status_code=503, detail="AI extract unavailable") from exc
    return ExtractAssumptionsResponse(assumptions=assumptions)


@router.post("/{workspace_id}/assumptions", response_model=ExtractAssumptionsResponse)
def persist_assumptions(
    workspace_id: str,
    body: PersistAssumptionsRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ExtractAssumptionsResponse:
    if store.get_workspace(workspace_id) is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    saved = store.insert_assumptions(workspace_id, body.assumptions)
    return ExtractAssumptionsResponse(assumptions=saved)
