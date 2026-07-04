"""Deterministic worksheet composition."""

from validation.schemas import IdeaWorksheet


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
