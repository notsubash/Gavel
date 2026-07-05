"""Deterministic worksheet composition and judge context."""

from __future__ import annotations

import html

from validation.schemas import Assumption, Evidence, IdeaWorksheet


def _xml_text(value: str) -> str:
    return html.escape(value.strip(), quote=False)


def compose_generated_document(worksheet: IdeaWorksheet) -> str:
    competitors = (
        "\n".join(f"- {c}" for c in worksheet.competitors)
        if worksheet.competitors
        else "None listed"
    )
    lines = [
        f"Working name: {worksheet.working_name}",
        "",
        f"Problem: I believe that {worksheet.audience} {worksheet.problem_statement}",
        "",
        f"Current workaround: {worksheet.current_workaround}",
        "",
        f"Solution: {worksheet.solution_statement}",
        "",
        f"Secret sauce: {worksheet.secret_sauce}",
        "",
        f"Pricing hypothesis: {worksheet.pricing_hypothesis}",
        "",
        f"Existing evidence: {worksheet.existing_evidence}",
        "",
        f"Competitors and alternatives:\n{competitors}",
        "",
        f"Top risky assumption: {worksheet.top_risky_assumption}",
        "",
        f"Disconfirming evidence: {worksheet.disconfirming_evidence}",
    ]
    if worksheet.trigger_event:
        lines.extend(["", f"Trigger event: {worksheet.trigger_event}"])
    return "\n".join(lines)


def build_judge_context(
    worksheet: IdeaWorksheet,
    assumptions: list[Assumption],
    evidence: list[Evidence],
    *,
    changes_since_last_run: str | None = None,
) -> str:
    competitors = ", ".join(worksheet.competitors) if worksheet.competitors else "None listed"
    idea_lines = [
        "<idea>",
        f"  <working_name>{_xml_text(worksheet.working_name)}</working_name>",
        f"  <audience>{_xml_text(worksheet.audience)}</audience>",
        f"  <problem>{_xml_text(worksheet.problem_statement)}</problem>",
        f"  <current_workaround>{_xml_text(worksheet.current_workaround)}</current_workaround>",
        f"  <solution>{_xml_text(worksheet.solution_statement)}</solution>",
        f"  <secret_sauce>{_xml_text(worksheet.secret_sauce)}</secret_sauce>",
        f"  <pricing>{_xml_text(worksheet.pricing_hypothesis)}</pricing>",
        f"  <existing_evidence>{_xml_text(worksheet.existing_evidence)}</existing_evidence>",
        f"  <competitors>{_xml_text(competitors)}</competitors>",
        f"  <top_risky_assumption>{_xml_text(worksheet.top_risky_assumption)}</top_risky_assumption>",
        "</idea>",
    ]

    summary_lines = ["<validation_summary>"]
    for assumption in assumptions[:20]:
        summary_lines.append(
            f'  <assumption status="{_xml_text(assumption.status)}" '
            f'type="{_xml_text(assumption.type)}" id="{_xml_text(assumption.id)}">'
            f"{_xml_text(assumption.statement)}</assumption>"
        )
    for item in evidence[:30]:
        summary_lines.append(
            f'  <evidence strength="{_xml_text(item.strength)}" '
            f'type="{_xml_text(item.type)}">{_xml_text(item.content)}</evidence>'
        )
    summary_lines.append("</validation_summary>")

    delta = (changes_since_last_run or "No worksheet changes since the last roast.").strip()
    change_lines = ["<changes_since_last_run>", _xml_text(delta), "</changes_since_last_run>"]

    return "\n".join([*idea_lines, "", *summary_lines, "", *change_lines])
