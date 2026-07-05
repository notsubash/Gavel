"""Deterministic workspace exports for sharing and judge prep."""

from __future__ import annotations

from datetime import UTC, datetime
import re

from api.schemas import RunListItem, VerdictSummary
from validation.compose import build_judge_context, compose_generated_document
from validation.schemas import (
    Assumption,
    ChecklistResponse,
    Evidence,
    Experiment,
    InterviewNote,
    ReadinessResponse,
    WorksheetVersion,
    Workspace,
)


def sanitize_export_slug(name: str, *, max_length: int = 80) -> str:
    slug = re.sub(r"[^\w\-]+", "-", name.strip()).strip("-")
    return (slug or "workspace")[:max_length]


def _fmt_dt(value: datetime | None) -> str:
    if value is None:
        return "—"
    return value.strftime("%Y-%m-%d")


def _verdict_line(summary: VerdictSummary | None) -> str:
    if summary is None:
        return "No verdict summary"
    parts = [
        f"pass {summary.pass_count}",
        f"fail {summary.fail_count}",
        f"conditional {summary.conditional_count}",
    ]
    if summary.avg_score is not None:
        parts.append(f"avg {summary.avg_score}")
    return ", ".join(parts)


def export_workspace_markdown(
    workspace: Workspace,
    version: WorksheetVersion,
    assumptions: list[Assumption],
    evidence: list[Evidence],
    experiments: list[Experiment],
    interviews: list[InterviewNote],
    *,
    checklist: ChecklistResponse | None = None,
    readiness: ReadinessResponse | None = None,
    runs: list[RunListItem] | None = None,
) -> str:
    """Full workspace export suitable for sharing."""
    ws = version.worksheet
    lines = [
        f"# {ws.working_name} — Validation Workspace",
        "",
        f"**Lifecycle:** {workspace.lifecycle} · **Worksheet version:** {version.version}",
        f"**Exported:** {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## Worksheet",
        "",
        compose_generated_document(ws),
        "",
    ]

    if checklist or readiness:
        lines.extend(["## Validation status", ""])
        if readiness:
            lines.append(f"- **Readiness:** {readiness.level}")
        if checklist:
            done = sum(1 for i in checklist.items if i.completed)
            lines.append(f"- **Checklist:** {done}/{len(checklist.items)} stages complete")
            lines.append(f"- **Next action:** {checklist.next_action}")
        lines.append("")

    if assumptions:
        lines.extend(["## Assumptions", ""])
        for a in assumptions:
            lines.append(f"- **[{a.status}/{a.type}]** {a.statement}")
        lines.append("")

    if evidence:
        lines.extend(["## Evidence", ""])
        for e in evidence:
            when = _fmt_dt(e.occurred_at)
            lines.append(f"- **[{e.strength}/{e.type}]** ({when}) {e.content}")
            if e.source:
                lines.append(f"  - Source: {e.source}")
        lines.append("")

    if experiments:
        lines.extend(["## Experiments", ""])
        for ex in experiments:
            lines.append(f"- **{ex.title}** ({ex.status}, decision: {ex.decision})")
            lines.append(f"  - Hypothesis: {ex.hypothesis}")
            if ex.result:
                lines.append(f"  - Result: {ex.result}")
        lines.append("")

    if interviews:
        lines.extend(["## Interviews", ""])
        for note in interviews:
            when = _fmt_dt(note.occurred_at)
            lines.append(f"- **{note.person_label or 'Interview'}** ({when})")
            if note.segment:
                lines.append(f"  - Segment: {note.segment}")
            lines.append(f"  - {note.notes}")
            if note.ai_summary:
                lines.append(f"  - AI summary: {note.ai_summary}")
        lines.append("")

    if runs:
        lines.extend(["## Roast history", ""])
        for run in runs:
            when = _fmt_dt(run.created_at)
            lines.append(
                f"- **{when}** — {run.status} · v{run.version} · {_verdict_line(run.verdict_summary)}"
            )
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def export_judge_brief(
    workspace: Workspace,
    version: WorksheetVersion,
    assumptions: list[Assumption],
    evidence: list[Evidence],
    *,
    readiness: ReadinessResponse | None = None,
    changes_since_last_run: str | None = None,
) -> str:
    """Human-readable brief for pre-roast review; feeds the same context as judges."""
    ws = version.worksheet
    judge_xml = build_judge_context(
        ws,
        assumptions,
        evidence,
        changes_since_last_run=changes_since_last_run,
    )
    lines = [
        f"# Judge-ready brief: {ws.working_name}",
        "",
        f"**Lifecycle:** {workspace.lifecycle} · **Worksheet version:** {version.version}",
        "",
        "## Readiness",
        "",
    ]
    if readiness:
        lines.append(f"**Level:** {readiness.level}")
        lines.append(f"**Can run judges:** {'yes' if readiness.can_run_judges else 'no'}")
        for check in readiness.checks:
            mark = "✓" if check.passed else "✗"
            detail = f" — {check.detail}" if check.detail else ""
            lines.append(f"- {mark} {check.name}{detail}")
    else:
        lines.append("Readiness not evaluated.")
    lines.extend(["", "## Structured judge context", "", "```xml", judge_xml, "```", ""])
    return "\n".join(lines).rstrip() + "\n"
