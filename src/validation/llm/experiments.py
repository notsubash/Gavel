"""LLM: suggest experiment card draft."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt, wrap_worksheet_context
from validation.schemas import Assumption, CreateExperimentRequest, IdeaWorksheet, ValidationStage


class _ExperimentDraft(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    hypothesis: str = Field(min_length=10, max_length=2000)
    method: str = Field(min_length=10, max_length=1000)
    target: str = Field(min_length=5, max_length=1000)
    pass_fail_threshold: str = Field(min_length=10, max_length=1000)


def suggest_experiment(
    worksheet: IdeaWorksheet,
    assumptions: list[Assumption],
    *,
    focus_assumption: Assumption | None = None,
    checklist_stage: ValidationStage | None = None,
) -> CreateExperimentRequest:
    model = build_assist_model()
    structured = model.with_structured_output(_ExperimentDraft)
    focus = focus_assumption or (assumptions[0] if assumptions else None)
    messages = [
        SystemMessage(content=render_validation_prompt("validation_experiment_system.jinja2")),
        HumanMessage(
            content=render_validation_prompt(
                "validation_experiment_user.jinja2",
                worksheet=wrap_worksheet_context(worksheet.model_dump_json(indent=2)),
                focus_assumption=focus.statement if focus else worksheet.top_risky_assumption,
                checklist_stage=checklist_stage or "problem_evidence",
            )
        ),
    ]

    def _invoke() -> _ExperimentDraft:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no experiment")
        return _ExperimentDraft.model_validate(result)

    draft = call_with_llm_retry(_invoke, label="suggest-experiment")
    return CreateExperimentRequest(
        title=draft.title,
        hypothesis=draft.hypothesis,
        assumption_id=focus.id if focus else None,
        method=draft.method,
        target=draft.target,
        pass_fail_threshold=draft.pass_fail_threshold,
        status="planned",
    )
