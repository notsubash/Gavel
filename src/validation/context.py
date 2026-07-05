"""Assemble validation context for computed views."""

from __future__ import annotations

from api.workspace_store import WorkspaceStore
from validation.checklist import build_checklist
from validation.confidence import compute_confidence
from validation.readiness import evaluate_readiness
from validation.schemas import ValidationOverviewResponse


def build_validation_overview(
    store: WorkspaceStore, workspace_id: str
) -> ValidationOverviewResponse | None:
    workspace = store.get_workspace(workspace_id)
    if workspace is None:
        return None
    version = store.get_current_version(workspace_id)
    if version is None:
        return None

    assumptions = store.list_assumptions(workspace_id)
    evidence = store.list_evidence(workspace_id)
    experiments = store.list_experiments(workspace_id)
    interviews = store.list_interviews(workspace_id)

    checklist = build_checklist(
        worksheet=version.worksheet,
        assumptions=assumptions,
        evidence=evidence,
        experiments=experiments,
        interviews=interviews,
    )
    confidence = compute_confidence(
        worksheet=version.worksheet,
        assumptions=assumptions,
        evidence=evidence,
    )
    readiness = evaluate_readiness(
        version.worksheet,
        evidence,
        has_prior_run=store.count_runs(workspace_id) > 0,
        worksheet_changed_since_run=store.worksheet_changed_since_last_run(workspace_id),
    )
    active = next((e for e in experiments if e.status == "active"), None)
    top_assumptions = assumptions[:3]

    return ValidationOverviewResponse(
        checklist=checklist,
        confidence=confidence,
        readiness=readiness,
        active_experiment=active,
        top_assumptions=top_assumptions,
    )
