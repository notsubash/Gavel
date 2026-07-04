"""Workspace and worksheet API routes."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

from api.workspace_store import WorkspaceStore, get_workspace_store
from validation.checklist import build_checklist
from validation.confidence import compute_confidence
from validation.context import build_validation_overview
from validation.llm.assumptions import extract_assumptions
from validation.llm.clarify import clarify_field
from validation.llm.coach import validation_coach
from validation.llm.draft import draft_from_notes
from validation.llm.evidence_map import map_evidence_to_assumptions
from validation.llm.experiments import suggest_experiment
from validation.llm.interviews import suggest_interview_questions
from validation.llm.summarize import summarize_interview
from validation.readiness import evaluate_readiness
from validation.schemas import (
    Assumption,
    ChecklistResponse,
    ClarifyFieldRequest,
    ClarifyFieldResponse,
    ConfidenceResponse,
    CreateAssumptionRequest,
    CreateEvidenceRequest,
    CreateExperimentRequest,
    CreateInterviewRequest,
    CreateWorkspaceRequest,
    DraftFromNotesRequest,
    DraftFromNotesResponse,
    Evidence,
    Experiment,
    ExtractAssumptionsResponse,
    InterviewNote,
    MapEvidenceRequest,
    MapEvidenceResponse,
    PersistAssumptionsRequest,
    ReadinessResponse,
    SuggestExperimentRequest,
    SuggestExperimentResponse,
    SuggestInterviewQuestionsRequest,
    SuggestInterviewQuestionsResponse,
    SummarizeInterviewRequest,
    SummarizeInterviewResponse,
    UpdateAssumptionRequest,
    UpdateEvidenceRequest,
    UpdateExperimentRequest,
    UpdateInterviewRequest,
    UpdateWorkspaceRequest,
    ValidationCoachResponse,
    ValidationOverviewResponse,
    WorksheetVersion,
    WorkspaceDetailResponse,
    WorkspaceListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _require_workspace(store: WorkspaceStore, workspace_id: str) -> None:
    if store.get_workspace(workspace_id) is None:
        raise HTTPException(status_code=404, detail="workspace not found")


def _require_version(store: WorkspaceStore, workspace_id: str) -> WorksheetVersion:
    version = store.get_current_version(workspace_id)
    if version is None:
        raise HTTPException(status_code=404, detail="worksheet version not found")
    return version


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


def _validation_state(store: WorkspaceStore, workspace_id: str):
    version = _require_version(store, workspace_id)
    assumptions = store.list_assumptions(workspace_id)
    evidence = store.list_evidence(workspace_id)
    experiments = store.list_experiments(workspace_id)
    interviews = store.list_interviews(workspace_id)
    return version, assumptions, evidence, experiments, interviews


@router.post("", response_model=WorkspaceDetailResponse, status_code=201)
def create_workspace(
    body: CreateWorkspaceRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> WorkspaceDetailResponse:
    workspace, version, _assumption = store.create_workspace(body.worksheet)
    store.sync_lifecycle(workspace.id)
    return WorkspaceDetailResponse(
        workspace=store.get_workspace(workspace.id) or workspace,
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


@router.get("/{workspace_id}/overview", response_model=ValidationOverviewResponse)
def get_validation_overview(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ValidationOverviewResponse:
    _require_workspace(store, workspace_id)
    overview = build_validation_overview(store, workspace_id)
    if overview is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    return overview


@router.patch("/{workspace_id}", response_model=WorkspaceDetailResponse)
def update_workspace(
    workspace_id: str,
    _body: UpdateWorkspaceRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> WorkspaceDetailResponse:
    """Lifecycle is derived from validation activity; PATCH is a no-op placeholder."""
    return _detail(store, workspace_id)


@router.get("/{workspace_id}/versions", response_model=list[WorksheetVersion])
def list_versions(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> list[WorksheetVersion]:
    """Phase 1 stub: returns current version only. Full history ships in Phase 3."""
    _require_workspace(store, workspace_id)
    version = store.get_current_version(workspace_id)
    return [version] if version else []


@router.get("/{workspace_id}/checklist", response_model=ChecklistResponse)
def get_checklist(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ChecklistResponse:
    version, assumptions, evidence, experiments, interviews = _validation_state(store, workspace_id)
    return build_checklist(
        worksheet=version.worksheet,
        assumptions=assumptions,
        evidence=evidence,
        experiments=experiments,
        interviews=interviews,
    )


@router.get("/{workspace_id}/confidence", response_model=ConfidenceResponse)
def get_confidence(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ConfidenceResponse:
    version, assumptions, evidence, _, _ = _validation_state(store, workspace_id)
    return compute_confidence(
        worksheet=version.worksheet,
        assumptions=assumptions,
        evidence=evidence,
    )


@router.get("/{workspace_id}/readiness", response_model=ReadinessResponse)
def get_readiness(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ReadinessResponse:
    version, _, evidence, _, _ = _validation_state(store, workspace_id)
    return evaluate_readiness(
        version.worksheet,
        evidence,
        has_prior_run=store.count_runs(workspace_id) > 0,
        worksheet_changed_since_run=store.worksheet_changed_since_last_run(workspace_id),
    )


# --- Assumptions ---


@router.get("/{workspace_id}/assumptions", response_model=list[Assumption])
def list_assumptions(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> list[Assumption]:
    _require_workspace(store, workspace_id)
    return store.list_assumptions(workspace_id)


@router.post("/{workspace_id}/assumptions", response_model=Assumption, status_code=201)
def create_assumption(
    workspace_id: str,
    body: CreateAssumptionRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> Assumption:
    _require_workspace(store, workspace_id)
    try:
        return store.create_assumption(workspace_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/{workspace_id}/assumptions/{assumption_id}", response_model=Assumption)
def update_assumption(
    workspace_id: str,
    assumption_id: str,
    body: UpdateAssumptionRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> Assumption:
    _require_workspace(store, workspace_id)
    updated = store.update_assumption(workspace_id, assumption_id, body)
    if updated is None:
        raise HTTPException(status_code=404, detail="assumption not found")
    return updated


@router.delete("/{workspace_id}/assumptions/{assumption_id}", status_code=204)
def delete_assumption(
    workspace_id: str,
    assumption_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> Response:
    _require_workspace(store, workspace_id)
    if not store.delete_assumption(workspace_id, assumption_id):
        raise HTTPException(status_code=404, detail="assumption not found")
    return Response(status_code=204)


@router.post("/{workspace_id}/assumptions/bulk", response_model=ExtractAssumptionsResponse)
def persist_assumptions(
    workspace_id: str,
    body: PersistAssumptionsRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ExtractAssumptionsResponse:
    _require_workspace(store, workspace_id)
    saved = store.insert_assumptions(workspace_id, body.assumptions)
    return ExtractAssumptionsResponse(assumptions=saved)


# --- Experiments ---


@router.get("/{workspace_id}/experiments", response_model=list[Experiment])
def list_experiments(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> list[Experiment]:
    _require_workspace(store, workspace_id)
    return store.list_experiments(workspace_id)


@router.post("/{workspace_id}/experiments", response_model=Experiment, status_code=201)
def create_experiment(
    workspace_id: str,
    body: CreateExperimentRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> Experiment:
    _require_workspace(store, workspace_id)
    try:
        return store.create_experiment(workspace_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/{workspace_id}/experiments/{experiment_id}", response_model=Experiment)
def update_experiment(
    workspace_id: str,
    experiment_id: str,
    body: UpdateExperimentRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> Experiment:
    _require_workspace(store, workspace_id)
    try:
        updated = store.update_experiment(workspace_id, experiment_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="experiment not found")
    return updated


@router.delete("/{workspace_id}/experiments/{experiment_id}", status_code=204)
def delete_experiment(
    workspace_id: str,
    experiment_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> Response:
    _require_workspace(store, workspace_id)
    if not store.delete_experiment(workspace_id, experiment_id):
        raise HTTPException(status_code=404, detail="experiment not found")
    return Response(status_code=204)


# --- Evidence ---


@router.get("/{workspace_id}/evidence", response_model=list[Evidence])
def list_evidence(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> list[Evidence]:
    _require_workspace(store, workspace_id)
    return store.list_evidence(workspace_id)


@router.post("/{workspace_id}/evidence", response_model=Evidence, status_code=201)
def create_evidence(
    workspace_id: str,
    body: CreateEvidenceRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> Evidence:
    _require_workspace(store, workspace_id)
    try:
        return store.create_evidence(workspace_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/{workspace_id}/evidence/{evidence_id}", response_model=Evidence)
def update_evidence(
    workspace_id: str,
    evidence_id: str,
    body: UpdateEvidenceRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> Evidence:
    _require_workspace(store, workspace_id)
    try:
        updated = store.update_evidence(workspace_id, evidence_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="evidence not found")
    return updated


@router.delete("/{workspace_id}/evidence/{evidence_id}", status_code=204)
def delete_evidence(
    workspace_id: str,
    evidence_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> Response:
    _require_workspace(store, workspace_id)
    if not store.delete_evidence(workspace_id, evidence_id):
        raise HTTPException(status_code=404, detail="evidence not found")
    return Response(status_code=204)


# --- Interviews ---


@router.get("/{workspace_id}/interviews", response_model=list[InterviewNote])
def list_interviews(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> list[InterviewNote]:
    _require_workspace(store, workspace_id)
    return store.list_interviews(workspace_id)


@router.post("/{workspace_id}/interviews", response_model=InterviewNote, status_code=201)
def create_interview(
    workspace_id: str,
    body: CreateInterviewRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> InterviewNote:
    _require_workspace(store, workspace_id)
    try:
        return store.create_interview(workspace_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/{workspace_id}/interviews/{interview_id}", response_model=InterviewNote)
def update_interview(
    workspace_id: str,
    interview_id: str,
    body: UpdateInterviewRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> InterviewNote:
    _require_workspace(store, workspace_id)
    try:
        updated = store.update_interview(workspace_id, interview_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="interview not found")
    return updated


@router.delete("/{workspace_id}/interviews/{interview_id}", status_code=204)
def delete_interview(
    workspace_id: str,
    interview_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> Response:
    _require_workspace(store, workspace_id)
    if not store.delete_interview(workspace_id, interview_id):
        raise HTTPException(status_code=404, detail="interview not found")
    return Response(status_code=204)


# --- LLM assists (pre-workspace) ---


@router.post("/draft-from-notes", response_model=DraftFromNotesResponse)
def assist_draft_from_notes_new(body: DraftFromNotesRequest) -> DraftFromNotesResponse:
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
    try:
        clarified = clarify_field(body.field_name, body.current_value, body.worksheet_context)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("clarify-field failed")
        raise HTTPException(status_code=503, detail="AI clarify unavailable") from exc
    return ClarifyFieldResponse(field_name=body.field_name, clarified_value=clarified)


# --- LLM assists (workspace-scoped) ---


@router.post("/{workspace_id}/assist/draft-from-notes", response_model=DraftFromNotesResponse)
def assist_draft_from_notes(
    workspace_id: str,
    body: DraftFromNotesRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> DraftFromNotesResponse:
    _require_workspace(store, workspace_id)
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
    _require_workspace(store, workspace_id)
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
    version = _require_version(store, workspace_id)
    try:
        assumptions = extract_assumptions(version.worksheet, workspace_id)
    except Exception as exc:
        logger.exception("extract-assumptions failed")
        raise HTTPException(status_code=503, detail="AI extract unavailable") from exc
    return ExtractAssumptionsResponse(assumptions=assumptions)


@router.post(
    "/{workspace_id}/assist/suggest-interview-questions",
    response_model=SuggestInterviewQuestionsResponse,
)
def assist_suggest_interview_questions(
    workspace_id: str,
    body: SuggestInterviewQuestionsRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> SuggestInterviewQuestionsResponse:
    version, assumptions, _, _, _ = _validation_state(store, workspace_id)
    focus = None
    if body.assumption_id:
        focus = store.get_assumption(workspace_id, body.assumption_id)
    try:
        questions = suggest_interview_questions(
            version.worksheet, assumptions, focus_assumption=focus
        )
    except Exception as exc:
        logger.exception("suggest-interview-questions failed")
        raise HTTPException(status_code=503, detail="AI assist unavailable") from exc
    return SuggestInterviewQuestionsResponse(questions=questions)


@router.post(
    "/{workspace_id}/assist/suggest-experiment",
    response_model=SuggestExperimentResponse,
)
def assist_suggest_experiment(
    workspace_id: str,
    body: SuggestExperimentRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> SuggestExperimentResponse:
    version, assumptions, _, _, _ = _validation_state(store, workspace_id)
    focus = None
    if body.assumption_id:
        focus = store.get_assumption(workspace_id, body.assumption_id)
    try:
        experiment = suggest_experiment(
            version.worksheet,
            assumptions,
            focus_assumption=focus,
            checklist_stage=body.checklist_stage,
        )
    except Exception as exc:
        logger.exception("suggest-experiment failed")
        raise HTTPException(status_code=503, detail="AI assist unavailable") from exc
    return SuggestExperimentResponse(experiment=experiment)


@router.post(
    "/{workspace_id}/assist/summarize-interview",
    response_model=SummarizeInterviewResponse,
)
def assist_summarize_interview(
    workspace_id: str,
    body: SummarizeInterviewRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> SummarizeInterviewResponse:
    _, assumptions, _, _, _ = _validation_state(store, workspace_id)
    try:
        summary, quotes, suggested_ids = summarize_interview(
            body.notes,
            assumptions,
            person_label=body.person_label,
            segment=body.segment,
        )
    except Exception as exc:
        logger.exception("summarize-interview failed")
        raise HTTPException(status_code=503, detail="AI assist unavailable") from exc
    return SummarizeInterviewResponse(
        summary=summary,
        extracted_quotes=quotes,
        suggested_assumption_ids=suggested_ids,
    )


@router.post("/{workspace_id}/assist/map-evidence", response_model=MapEvidenceResponse)
def assist_map_evidence(
    workspace_id: str,
    body: MapEvidenceRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> MapEvidenceResponse:
    _, assumptions, _, _, _ = _validation_state(store, workspace_id)
    try:
        suggested_ids, rationale = map_evidence_to_assumptions(
            body.content,
            body.type,
            assumptions,
            existing_ids=body.assumption_ids,
        )
    except Exception as exc:
        logger.exception("map-evidence failed")
        raise HTTPException(status_code=503, detail="AI assist unavailable") from exc
    return MapEvidenceResponse(suggested_assumption_ids=suggested_ids, rationale=rationale)


@router.post("/{workspace_id}/assist/validation-coach", response_model=ValidationCoachResponse)
def assist_validation_coach(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ValidationCoachResponse:
    overview = build_validation_overview(store, workspace_id)
    if overview is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    version = _require_version(store, workspace_id)
    try:
        return validation_coach(
            version.worksheet,
            overview.checklist,
            overview.confidence,
            overview.readiness,
        )
    except Exception as exc:
        logger.exception("validation-coach failed")
        raise HTTPException(status_code=503, detail="AI coach unavailable") from exc
