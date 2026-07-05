"""Deterministic readiness gate (Appendix A)."""

from __future__ import annotations

from validation.schemas import (
    Evidence,
    IdeaWorksheet,
    ReadinessCheck,
    ReadinessLevel,
    ReadinessResponse,
)

_HUMAN_EVIDENCE_TYPES = frozenset(
    {"interview_quote", "loi", "payment", "usage", "experiment_metric", "founder_note"}
)


def evaluate_readiness(
    worksheet: IdeaWorksheet,
    evidence: list[Evidence],
    *,
    has_prior_run: bool = False,
    worksheet_changed_since_run: bool = False,
) -> ReadinessResponse:
    checks: list[ReadinessCheck] = []

    audience_ok = len(worksheet.audience.strip()) >= 10
    checks.append(
        ReadinessCheck(
            name="audience",
            passed=audience_ok,
            detail="Audience must be at least 10 characters",
        )
    )

    problem = worksheet.problem_statement.strip()
    solution = worksheet.solution_statement.strip()
    problem_ok = len(problem) >= 10 and problem.lower() != solution.lower()
    checks.append(
        ReadinessCheck(
            name="problem_statement",
            passed=problem_ok,
            detail="Problem must be distinct from solution",
        )
    )

    solution_ok = len(solution) >= 10
    checks.append(
        ReadinessCheck(
            name="solution_statement",
            passed=solution_ok,
            detail="Solution statement required",
        )
    )

    workaround_ok = bool(worksheet.current_workaround.strip()) or bool(worksheet.competitors)
    checks.append(
        ReadinessCheck(
            name="workaround_or_competitors",
            passed=workaround_ok,
            detail="Current workaround or competitors required",
        )
    )

    assumption_ok = len(worksheet.top_risky_assumption.strip()) >= 10
    checks.append(
        ReadinessCheck(
            name="top_risky_assumption",
            passed=assumption_ok,
            detail="Top risky assumption required",
        )
    )

    checks.append(
        ReadinessCheck(
            name="pricing_hypothesis",
            passed=bool(worksheet.pricing_hypothesis.strip()),
            detail='Pricing hypothesis or "unknown"',
        )
    )

    checks.append(
        ReadinessCheck(
            name="existing_evidence",
            passed=bool(worksheet.existing_evidence.strip()),
            detail='Existing evidence field or "none yet"',
        )
    )

    human_evidence = [e for e in evidence if e.type in _HUMAN_EVIDENCE_TYPES]
    has_human = len(human_evidence) > 0

    if has_prior_run:
        rerun_ok = has_human or worksheet_changed_since_run
        checks.append(
            ReadinessCheck(
                name="rerun_delta",
                passed=rerun_ok,
                detail="Re-run requires new evidence or worksheet changes",
            )
        )

    structure_passed = all(c.passed for c in checks if c.name != "rerun_delta")
    if not structure_passed:
        level: ReadinessLevel = "too_vague"
    elif not has_human:
        level = "speculative"
    else:
        level = "ready"

    can_run = level in ("speculative", "ready")
    if has_prior_run and not all(c.passed for c in checks):
        can_run = False

    return ReadinessResponse(level=level, checks=checks, can_run_judges=can_run)
