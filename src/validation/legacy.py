"""Map legacy flat run requests to structured worksheets."""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from api.schemas import CreateRunRequest
from validation.schemas import IdeaWorksheet


class LegacyCreateRunRequest(BaseModel):
    """Stored shape for runs created before workspace-first intake."""

    model_config = ConfigDict(extra="ignore")

    idea: str = Field(min_length=10, max_length=8000)
    target_customer: str | None = None
    pricing: str | None = None
    traction: str | None = None
    competitors: list[str] = Field(default_factory=list)
    model_runtime: str = "deepseek"
    execution_flow: str = "deterministic"
    max_debate_rounds: int = 3
    enable_web_search: bool = False
    parent_run_id: str | None = None
    version: int = 1

    @model_validator(mode="after")
    def reject_deepagents(self) -> LegacyCreateRunRequest:
        if self.execution_flow == "deepagents":
            raise ValueError("execution_flow 'deepagents' is not supported")
        return self


def _clip(text: str | None, fallback: str, min_len: int, max_len: int) -> str:
    raw = (text or "").strip() or fallback
    if len(raw) < min_len:
        raw = fallback if len(fallback) >= min_len else raw.ljust(min_len, ".")
    return raw[:max_len]


def legacy_request_to_worksheet(
    request: LegacyCreateRunRequest | CreateRunRequest,
) -> IdeaWorksheet:
    if isinstance(request, CreateRunRequest):
        raise TypeError("legacy_request_to_worksheet expects legacy flat requests")
    idea = request.idea.strip()
    first_line = idea.split("\n", 1)[0].strip()[:120] or "Untitled Idea"
    audience = _clip(
        request.target_customer,
        "Early-stage founders exploring this idea",
        10,
        2000,
    )
    competitors = [c.strip() for c in (request.competitors or []) if c.strip()][:20]
    return IdeaWorksheet(
        working_name=first_line,
        audience=audience,
        problem_statement=_clip(idea, "The problem is not yet clearly stated.", 10, 4000),
        current_workaround=_clip(
            "Competitors and manual workarounds not specified in legacy intake.",
            "They use spreadsheets, docs, or informal workarounds.",
            10,
            4000,
        ),
        solution_statement=_clip(
            idea,
            "A solution has been proposed but not yet detailed.",
            10,
            4000,
        ),
        secret_sauce=_clip(
            "Differentiation not captured in legacy intake.",
            "Approach differs from incumbents in execution focus.",
            10,
            2000,
        ),
        pricing_hypothesis=_clip(request.pricing, "unknown", 1, 2000),
        existing_evidence=_clip(request.traction, "none yet", 1, 4000),
        competitors=competitors,
        top_risky_assumption=_clip(
            "Demand and willingness to pay must be validated.",
            "Target customers will adopt this solution.",
            10,
            1000,
        ),
        disconfirming_evidence=_clip(
            "Customers show no interest after structured outreach.",
            "Five target users say they would not switch from current workaround.",
            10,
            2000,
        ),
    )


def parse_stored_run_request(
    run_id: str,
    request_json: str,
    *,
    workspace_id: str | None = None,
    worksheet_version_id: str | None = None,
) -> CreateRunRequest:
    data: dict[str, Any] = json.loads(request_json)
    if "workspace_id" in data:
        return CreateRunRequest.model_validate(data)

    legacy = LegacyCreateRunRequest.model_validate(data)
    if workspace_id is None or worksheet_version_id is None:
        raise ValueError(f"legacy run {run_id!r} missing workspace link")
    return CreateRunRequest(
        workspace_id=workspace_id,
        worksheet_version_id=worksheet_version_id,
        model_runtime=legacy.model_runtime,  # type: ignore[arg-type]
        execution_flow="deterministic",
        max_debate_rounds=legacy.max_debate_rounds,
        enable_web_search=legacy.enable_web_search,
        parent_run_id=legacy.parent_run_id,
        version=legacy.version,
    )
