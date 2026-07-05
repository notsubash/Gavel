"""LLM: Mom-Test-style interview questions."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt, wrap_worksheet_context
from validation.schemas import Assumption, IdeaWorksheet, InterviewQuestion


class _QuestionsResult(BaseModel):
    questions: list[InterviewQuestion] = Field(min_length=3, max_length=8)


def suggest_interview_questions(
    worksheet: IdeaWorksheet,
    assumptions: list[Assumption],
    *,
    focus_assumption: Assumption | None = None,
) -> list[InterviewQuestion]:
    model = build_assist_model()
    structured = model.with_structured_output(_QuestionsResult)
    focus = focus_assumption.statement if focus_assumption else worksheet.top_risky_assumption
    messages = [
        SystemMessage(
            content=render_validation_prompt("validation_interview_questions_system.jinja2")
        ),
        HumanMessage(
            content=render_validation_prompt(
                "validation_interview_questions_user.jinja2",
                worksheet=wrap_worksheet_context(worksheet.model_dump_json(indent=2)),
                focus_assumption=focus,
                assumptions_json=wrap_worksheet_context(
                    "\n".join(f"- [{a.type}] {a.statement}" for a in assumptions[:5])
                ),
            )
        ),
    ]

    def _invoke() -> _QuestionsResult:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no questions")
        return _QuestionsResult.model_validate(result)

    return call_with_llm_retry(_invoke, label="suggest-interview-questions").questions
