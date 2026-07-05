"""LLM: map evidence to assumptions."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from idea_context import wrap_untrusted
from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt
from validation.schemas import Assumption, EvidenceType


class _MapResult(BaseModel):
    assumption_ids: list[str] = Field(default_factory=list, max_length=5)
    rationale: str | None = Field(default=None, max_length=500)


def map_evidence_to_assumptions(
    content: str,
    evidence_type: EvidenceType,
    assumptions: list[Assumption],
    *,
    existing_ids: list[str] | None = None,
) -> tuple[list[str], str | None]:
    if not assumptions:
        return list(existing_ids or []), None

    model = build_assist_model()
    structured = model.with_structured_output(_MapResult)
    catalog = "\n".join(f"{a.id}: [{a.type}] {a.statement}" for a in assumptions)
    messages = [
        SystemMessage(content=render_validation_prompt("validation_map_evidence_system.jinja2")),
        HumanMessage(
            content=render_validation_prompt(
                "validation_map_evidence_user.jinja2",
                content=wrap_untrusted(content, "evidence"),
                evidence_type=evidence_type,
                assumptions=wrap_untrusted(catalog, "assumptions"),
            )
        ),
    ]

    def _invoke() -> _MapResult:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no mapping")
        return _MapResult.model_validate(result)

    out = call_with_llm_retry(_invoke, label="map-evidence")
    valid_ids = {a.id for a in assumptions}
    suggested = [aid for aid in out.assumption_ids if aid in valid_ids]
    if existing_ids:
        for aid in existing_ids:
            if aid in valid_ids and aid not in suggested:
                suggested.append(aid)
    return suggested, out.rationale
