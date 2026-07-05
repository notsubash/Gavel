"""Workspace and worksheet API routes."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import PlainTextResponse

from api.routes.runs import _run_list_item
from api.run_manager import RunManager, get_run_manager
from api.schemas import RunListResponse
from api.workspace_store import WorkspaceStore, get_workspace_store
from validation.checklist import build_checklist
from validation.competitor_scan import competitor_scan
from validation.confidence import compute_confidence
from validation.context import build_validation_overview
from validation.export import export_judge_brief, export_workspace_markdown, sanitize_export_slug
from validation.fixtures import seed_sample_workspace
from validation.llm.assumptions import extract_assumptions
from validation.llm.clarify import clarify_field
from validation.llm.coach import validation_coach
from validation.llm.draft import draft_from_notes
from validation.llm.evidence_map import map_evidence_to_assumptions
from validation.llm.experiments import suggest_experiment
from validation.llm.interviews import suggest_interview_questions
from validation.llm.readiness import readiness_briefing
from validation.llm.revise import revise_from_evidence
from validation.llm.summarize import summarize_interview
from validation.llm.weekly_review import weekly_review
from validation.readiness import evaluate_readiness
from validation.schemas import (
    Assumption,
    ChecklistResponse,
    ClarifyFieldRequest,
    ClarifyFieldResponse,
    CompetitorScanResponse,
    ConfidenceResponse,
    CreateAssumptionRequest,
    CreateEvidenceRequest,
    CreateExperimentRequest,
    CreateInterviewRequest,
    CreateWorksheetVersionRequest,
    CreateWorksheetVersionResponse,
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
    ReadinessBriefingResponse,
    ReadinessResponse,
    ReviseFromEvidenceRequest,
    ReviseFromEvidenceResponse,
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
    WeeklyReviewResponse,
    WorksheetFieldChange,
    WorksheetVersion,
    WorksheetVersionDiffResponse,
    WorkspaceDetailResponse,
    WorkspaceListResponse,
)
from validation.versioning import build_change_summary, compute_worksheet_diff

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


@router.post("/seed-sample", response_model=WorkspaceDetailResponse, status_code=201)
def seed_sample(
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> WorkspaceDetailResponse:
    return seed_sample_workspace(store)


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
    _require_workspace(store, workspace_id)
    return store.list_versions(workspace_id)


@router.get("/{workspace_id}/versions/{version_id}", response_model=WorksheetVersion)
def get_version(
    workspace_id: str,
    version_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> WorksheetVersion:
    _require_workspace(store, workspace_id)
    version = store.get_version(version_id)
    if version is None or version.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="worksheet version not found")
    return version


@router.get(
    "/{workspace_id}/versions/{version_id}/diff",
    response_model=WorksheetVersionDiffResponse,
)
def get_version_diff(
    workspace_id: str,
    version_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
    compare_to: str | None = None,
) -> WorksheetVersionDiffResponse:
    _require_workspace(store, workspace_id)
    to_version = store.get_version(version_id)
    if to_version is None or to_version.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="worksheet version not found")

    from_id = compare_to or to_version.parent_version_id
    if from_id is None:
        return WorksheetVersionDiffResponse(
            from_version_id=version_id,
            to_version_id=version_id,
            changes=[],
            change_summary=to_version.change_summary,
        )

    from_version = store.get_version(from_id)
    if from_version is None or from_version.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="compare version not found")

    raw_diff = store.version_diff(workspace_id, from_id, version_id) or []
    changes = [WorksheetFieldChange.model_validate(item) for item in raw_diff]
    return WorksheetVersionDiffResponse(
        from_version_id=from_id,
        to_version_id=version_id,
        changes=changes,
        change_summary=to_version.change_summary,
    )


@router.post(
    "/{workspace_id}/versions",
    response_model=CreateWorksheetVersionResponse,
)
def create_worksheet_version(
    workspace_id: str,
    body: CreateWorksheetVersionRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> CreateWorksheetVersionResponse:
    _require_workspace(store, workspace_id)
    try:
        version, created, diff = store.save_worksheet(
            workspace_id,
            body.worksheet,
            minor_edit=body.minor_edit,
            change_summary=body.change_summary,
            base_version_id=body.base_version_id,
        )
    except WorkspaceStore.VersionConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    changes = [WorksheetFieldChange.model_validate(item) for item in diff]
    return CreateWorksheetVersionResponse(version=version, created=created, diff=changes)


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


@router.post(
    "/{workspace_id}/assist/readiness-briefing",
    response_model=ReadinessBriefingResponse,
)
def assist_readiness_briefing(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ReadinessBriefingResponse:
    version, _, evidence, _, _ = _validation_state(store, workspace_id)
    readiness = evaluate_readiness(
        version.worksheet,
        evidence,
        has_prior_run=store.count_runs(workspace_id) > 0,
        worksheet_changed_since_run=store.worksheet_changed_since_last_run(workspace_id),
    )
    try:
        return readiness_briefing(version.worksheet, readiness)
    except Exception as exc:
        logger.exception("readiness-briefing failed")
        raise HTTPException(status_code=503, detail="AI briefing unavailable") from exc


@router.get("/{workspace_id}/runs", response_model=RunListResponse)
def list_workspace_runs(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
    manager: Annotated[RunManager, Depends(get_run_manager)],
    limit: int = 20,
    offset: int = 0,
) -> RunListResponse:
    _require_workspace(store, workspace_id)
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
    if offset < 0:
        raise HTTPException(status_code=422, detail="offset must be >= 0")
    items, total = manager.list_runs_for_workspace(workspace_id, limit=limit, offset=offset)
    return RunListResponse(
        runs=[_run_list_item(record, summary) for record, summary in items],
        total=total,
        limit=limit,
        offset=offset,
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


@router.post(
    "/{workspace_id}/assist/revise-from-evidence",
    response_model=ReviseFromEvidenceResponse,
)
def assist_revise_from_evidence(
    workspace_id: str,
    body: ReviseFromEvidenceRequest,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> ReviseFromEvidenceResponse:
    version, _, evidence, experiments, _ = _validation_state(store, workspace_id)
    focus = None
    if body.experiment_id:
        focus = store.get_experiment(workspace_id, body.experiment_id)
        if focus is None:
            raise HTTPException(status_code=404, detail="experiment not found")
        if focus.status != "completed":
            raise HTTPException(
                status_code=422,
                detail="focus experiment must be completed before revising worksheet",
            )
    try:
        return revise_from_evidence(
            version.worksheet,
            experiments,
            evidence,
            focus_experiment=focus,
        )
    except Exception as exc:
        logger.exception("revise-from-evidence failed")
        raise HTTPException(status_code=503, detail="AI revise unavailable") from exc


@router.get("/{workspace_id}/export/markdown", response_class=PlainTextResponse)
def export_markdown(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
    manager: Annotated[RunManager, Depends(get_run_manager)],
) -> PlainTextResponse:
    workspace = store.get_workspace(workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    version, assumptions, evidence, experiments, interviews = _validation_state(store, workspace_id)
    overview = build_validation_overview(store, workspace_id)
    run_items, _ = manager.list_runs_for_workspace(workspace_id, limit=20, offset=0)
    runs = [_run_list_item(record, summary) for record, summary in run_items]
    body = export_workspace_markdown(
        workspace,
        version,
        assumptions,
        evidence,
        experiments,
        interviews,
        checklist=overview.checklist if overview else None,
        readiness=overview.readiness if overview else None,
        runs=runs,
    )
    filename = f"{sanitize_export_slug(version.worksheet.working_name)}-export.md"
    return PlainTextResponse(
        content=body,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{workspace_id}/export/judge-brief", response_class=PlainTextResponse)
def export_judge_brief_route(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> PlainTextResponse:
    workspace = store.get_workspace(workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    version, assumptions, evidence, _, _ = _validation_state(store, workspace_id)
    readiness = evaluate_readiness(
        version.worksheet,
        evidence,
        has_prior_run=store.count_runs(workspace_id) > 0,
        worksheet_changed_since_run=store.worksheet_changed_since_last_run(workspace_id),
    )
    last_version_id = store.get_last_run_version_id(workspace_id)
    changes = None
    if last_version_id and last_version_id != version.id:
        prior = store.get_version(last_version_id)
        if prior:
            diff = compute_worksheet_diff(prior.worksheet, version.worksheet)
            changes = build_change_summary(diff)
    body = export_judge_brief(
        workspace,
        version,
        assumptions,
        evidence,
        readiness=readiness,
        changes_since_last_run=changes,
    )
    filename = f"{sanitize_export_slug(version.worksheet.working_name)}-judge-brief.md"
    return PlainTextResponse(
        content=body,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{workspace_id}/assist/weekly-review", response_model=WeeklyReviewResponse)
def assist_weekly_review(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> WeeklyReviewResponse:
    version, assumptions, evidence, experiments, _ = _validation_state(store, workspace_id)
    try:
        return weekly_review(version.worksheet, assumptions, evidence, experiments)
    except Exception as exc:
        logger.exception("weekly-review failed")
        raise HTTPException(status_code=503, detail="AI weekly review unavailable") from exc


@router.post("/{workspace_id}/assist/competitor-scan", response_model=CompetitorScanResponse)
def assist_competitor_scan(
    workspace_id: str,
    store: Annotated[WorkspaceStore, Depends(get_workspace_store)],
) -> CompetitorScanResponse:
    version = _require_version(store, workspace_id)
    try:
        return competitor_scan(version.worksheet)
    except Exception as exc:
        logger.exception("competitor-scan failed")
        raise HTTPException(status_code=503, detail="Competitor scan unavailable") from exc
