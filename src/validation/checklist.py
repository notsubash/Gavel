"""Deterministic validation checklist and next-action computation."""

from __future__ import annotations

from validation.schemas import (
    Assumption,
    ChecklistResponse,
    Evidence,
    Experiment,
    IdeaWorksheet,
    InterviewNote,
    ValidationChecklistItem,
    ValidationStage,
)

_STAGE_LABELS: dict[ValidationStage, str] = {
    "problem_clarity": "Problem is clear and falsifiable",
    "problem_evidence": "Problem validated with real behavior",
    "solution_evidence": "Solution tested with target users",
    "willingness_to_pay": "Willingness to pay tested",
    "channel": "Channel to reach audience tested",
    "competition_moat": "Competition and moat understood",
}

_PROBLEM_EVIDENCE_TYPES = frozenset({"interview_quote", "founder_note"})
_PAYMENT_EVIDENCE_TYPES = frozenset({"loi", "payment"})
_SOLUTION_EVIDENCE_TYPES = frozenset({"experiment_metric", "usage"})
_CHANNEL_EVIDENCE_TYPES = frozenset({"market_research"})
_COMPETITION_EVIDENCE_TYPES = frozenset({"competitor_research"})


def _problem_clarity_complete(worksheet: IdeaWorksheet) -> bool:
    problem = worksheet.problem_statement.strip().lower()
    solution = worksheet.solution_statement.strip().lower()
    return (
        len(worksheet.audience.strip()) >= 10
        and len(problem) >= 10
        and problem != solution
        and len(worksheet.current_workaround.strip()) >= 10
        and len(worksheet.top_risky_assumption.strip()) >= 10
    )


def _problem_evidence_complete(interviews: list[InterviewNote], evidence: list[Evidence]) -> bool:
    if interviews:
        return True
    return any(e.type in _PROBLEM_EVIDENCE_TYPES for e in evidence)


def _solution_evidence_complete(evidence: list[Evidence], experiments: list[Experiment]) -> bool:
    if any(e.type in _SOLUTION_EVIDENCE_TYPES for e in evidence):
        return True
    return any(
        ex.status == "completed" and ex.decision in ("continue", "retest") for ex in experiments
    )


def _willingness_to_pay_complete(evidence: list[Evidence], assumptions: list[Assumption]) -> bool:
    if any(e.type in _PAYMENT_EVIDENCE_TYPES for e in evidence):
        return True
    return any(a.type == "pricing" and a.status in ("supported", "testing") for a in assumptions)


def _channel_complete(evidence: list[Evidence], assumptions: list[Assumption]) -> bool:
    if any(e.type in _CHANNEL_EVIDENCE_TYPES for e in evidence):
        return True
    return any(a.type == "channel" and a.status in ("supported", "testing") for a in assumptions)


def _competition_moat_complete(
    worksheet: IdeaWorksheet, evidence: list[Evidence], assumptions: list[Assumption]
) -> bool:
    if worksheet.competitors:
        return True
    if any(e.type in _COMPETITION_EVIDENCE_TYPES for e in evidence):
        return True
    return any(
        a.type in ("competition", "moat") and a.status in ("supported", "testing")
        for a in assumptions
    )


def _stage_complete(
    stage: ValidationStage,
    *,
    worksheet: IdeaWorksheet,
    assumptions: list[Assumption],
    evidence: list[Evidence],
    experiments: list[Experiment],
    interviews: list[InterviewNote],
) -> bool:
    checks = {
        "problem_clarity": lambda: _problem_clarity_complete(worksheet),
        "problem_evidence": lambda: _problem_evidence_complete(interviews, evidence),
        "solution_evidence": lambda: _solution_evidence_complete(evidence, experiments),
        "willingness_to_pay": lambda: _willingness_to_pay_complete(evidence, assumptions),
        "channel": lambda: _channel_complete(evidence, assumptions),
        "competition_moat": lambda: _competition_moat_complete(worksheet, evidence, assumptions),
    }
    return checks[stage]()


def _next_action(
    *,
    worksheet: IdeaWorksheet,
    assumptions: list[Assumption],
    evidence: list[Evidence],
    experiments: list[Experiment],
    interviews: list[InterviewNote],
    items: list[ValidationChecklistItem],
) -> tuple[str, ValidationStage | None]:
    active = next((e for e in experiments if e.status == "active"), None)
    if active:
        return f"Run your experiment: {active.title}", "solution_evidence"

    incomplete = next((i for i in items if not i.completed), None)
    if incomplete is None:
        return "Review readiness before running judges", None

    stage = incomplete.stage
    if stage == "problem_clarity":
        return "Sharpen audience and problem until they stand without the solution", stage
    if stage == "problem_evidence":
        if not interviews:
            return "Plan your first customer interview", stage
        return "Log evidence from recent conversations", stage
    if stage == "solution_evidence":
        top = assumptions[0].statement if assumptions else worksheet.top_risky_assumption
        return f"Design an experiment to test: {top[:80]}", stage
    if stage == "willingness_to_pay":
        return "Test pricing with a real commitment (deposit, LOI, or paid pilot)", stage
    if stage == "channel":
        return "Run a small outreach test to reach your target audience", stage
    return "Map competitors and articulate why customers would switch now", stage


def build_checklist(
    *,
    worksheet: IdeaWorksheet,
    assumptions: list[Assumption],
    evidence: list[Evidence],
    experiments: list[Experiment],
    interviews: list[InterviewNote],
) -> ChecklistResponse:
    items: list[ValidationChecklistItem] = []
    for stage in _STAGE_LABELS:
        completed = _stage_complete(
            stage,
            worksheet=worksheet,
            assumptions=assumptions,
            evidence=evidence,
            experiments=experiments,
            interviews=interviews,
        )
        items.append(
            ValidationChecklistItem(
                stage=stage,
                label=_STAGE_LABELS[stage],
                completed=completed,
                completed_at=None,
                auto_completed=completed,
            )
        )

    next_action, next_stage = _next_action(
        worksheet=worksheet,
        assumptions=assumptions,
        evidence=evidence,
        experiments=experiments,
        interviews=interviews,
        items=items,
    )
    return ChecklistResponse(items=items, next_action=next_action, next_stage=next_stage)
