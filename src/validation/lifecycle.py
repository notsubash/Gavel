"""Derive workspace lifecycle from validation state."""

from __future__ import annotations

from validation.schemas import (
    Evidence,
    Experiment,
    InterviewNote,
    ReadinessLevel,
    WorkspaceLifecycle,
)


def compute_lifecycle(
    *,
    run_count: int,
    readiness_level: ReadinessLevel,
    experiments: list[Experiment],
    interviews: list[InterviewNote],
    evidence: list[Evidence],
    worksheet_changed_since_run: bool = False,
) -> WorkspaceLifecycle:
    if run_count > 0:
        # ponytail: worksheet delta only; evidence-only post-roast stays "judged"
        return "iterating" if worksheet_changed_since_run else "judged"

    if any(e.status == "active" for e in experiments):
        return "testing"

    if readiness_level == "ready":
        return "evidence_ready"

    has_discovery_signal = bool(interviews) or any(
        e.type in ("interview_quote", "founder_note", "experiment_metric") for e in evidence
    )
    if has_discovery_signal:
        return "discovery"

    return "draft"
