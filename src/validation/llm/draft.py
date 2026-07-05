"""LLM: messy notes → structured worksheet draft."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from idea_context import wrap_untrusted
from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt
from validation.schemas import IdeaWorksheet


class _DraftResult(BaseModel):
    worksheet: IdeaWorksheet
    ai_drafted_fields: list[str] = Field(default_factory=list)


def draft_from_notes(notes: str) -> tuple[IdeaWorksheet, list[str]]:
    model = build_assist_model()
    structured = model.with_structured_output(_DraftResult)
    messages = [
        SystemMessage(content=render_validation_prompt("validation_draft_system.jinja2")),
        HumanMessage(
            content=render_validation_prompt(
                "validation_draft_user.jinja2",
                founder_notes=wrap_untrusted(notes, "founder_notes"),
            )
        ),
    ]

    def _invoke() -> _DraftResult:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no draft")
        return _DraftResult.model_validate(result)

    draft = call_with_llm_retry(_invoke, label="draft-from-notes")
    return draft.worksheet, draft.ai_drafted_fields
