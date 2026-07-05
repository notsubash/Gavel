"""LLM: suggest worksheet patches from validation evidence."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt, wrap_worksheet_context
from validation.schemas import (
    Evidence,
    Experiment,
    IdeaWorksheet,
    ReviseFromEvidenceResponse,
    WorksheetFieldPatch,
)

_PATCHABLE_FIELDS = frozenset(
    {
        "audience",
        "problem_statement",
        "current_workaround",
        "solution_statement",
        "secret_sauce",
        "pricing_hypothesis",
        "existing_evidence",
        "top_risky_assumption",
        "disconfirming_evidence",
    }
)


class _PatchItem(BaseModel):
    field_name: str
    suggested_value: str = Field(min_length=1, max_length=4000)
    rationale: str = Field(min_length=10, max_length=1000)


class _ReviseResult(BaseModel):
    patches: list[_PatchItem] = Field(default_factory=list, max_length=8)
    summary: str = Field(min_length=10, max_length=2000)


def revise_from_evidence(
    worksheet: IdeaWorksheet,
    experiments: list[Experiment],
    evidence: list[Evidence],
    *,
    focus_experiment: Experiment | None = None,
) -> ReviseFromEvidenceResponse:
    completed = [e for e in experiments if e.status == "completed"]
    recent_evidence = evidence[:12]
    model = build_assist_model()
    structured = model.with_structured_output(_ReviseResult)

    exp_lines = (
        "\n".join(
            f"- {e.title}: decision={e.decision}, result={e.result or 'n/a'}" for e in completed
        )
        or "None completed yet."
    )
    ev_lines = "\n".join(
        f"- [{ev.type}/{ev.strength}] {ev.content[:300]}" for ev in recent_evidence
    )
    focus = (
        f"{focus_experiment.title}: {focus_experiment.result or focus_experiment.hypothesis}"
        if focus_experiment
        else "None"
    )

    messages = [
        SystemMessage(content=render_validation_prompt("validation_revise_system.jinja2")),
        HumanMessage(
            content=render_validation_prompt(
                "validation_revise_user.jinja2",
                worksheet=wrap_worksheet_context(worksheet.model_dump_json(indent=2)),
                experiments=wrap_worksheet_context(exp_lines),
                evidence=wrap_worksheet_context(ev_lines or "None logged yet."),
                focus_experiment=wrap_worksheet_context(focus),
            )
        ),
    ]

    def _invoke() -> _ReviseResult:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no revise output")
        return _ReviseResult.model_validate(result)

    out = call_with_llm_retry(_invoke, label="revise-from-evidence")
    patches: list[WorksheetFieldPatch] = []
    for item in out.patches:
        if item.field_name not in _PATCHABLE_FIELDS:
            continue
        patches.append(
            WorksheetFieldPatch(
                field_name=item.field_name,  # type: ignore[arg-type]
                suggested_value=item.suggested_value,
                rationale=item.rationale,
            )
        )
    return ReviseFromEvidenceResponse(patches=patches, summary=out.summary)
