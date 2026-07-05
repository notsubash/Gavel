"""Frontend-safe API request and response models."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

RunStatus = Literal["created", "running", "completed", "failed", "cancelled"]
IDEA_MAX_LENGTH = 8000


class CreateRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: str = Field(min_length=1, max_length=64)
    worksheet_version_id: str | None = Field(
        default=None,
        description="Defaults to workspace current version.",
    )
    model_runtime: Literal["local", "deepseek"] = "deepseek"
    execution_flow: Literal["deterministic", "deepagents"] = "deterministic"
    max_debate_rounds: int = Field(default=3, ge=1, le=5)
    enable_web_search: bool = False
    parent_run_id: str | None = None
    readiness_override: bool = False
    version: int = Field(default=1, ge=1)

    @model_validator(mode="after")
    def reject_unsupported_execution_flow(self) -> "CreateRunRequest":
        if self.execution_flow == "deepagents":
            raise ValueError(
                "execution_flow 'deepagents' is not supported by the streaming API yet; "
                "use 'deterministic'."
            )
        return self


class RunCreatedResponse(BaseModel):
    run_id: str
    status: Literal["created"] = "created"


class RunStatusResponse(BaseModel):
    run_id: str
    status: RunStatus
    idea: str
    idea_preview: str
    created_at: datetime
    workspace_id: str | None = None
    worksheet_version_id: str | None = None
    working_name: str | None = None
    parent_run_id: str | None = None
    version: int = 1


class RunPanelResponse(BaseModel):
    verdicts: list[dict[str, Any]]
    confidence_snapshot: dict[str, Any] | None = None


class ApiEventEnvelope(BaseModel):
    type: str
    run_id: str
    sequence: int = Field(ge=0)
    payload: dict[str, Any]
    created_at: datetime


APPEAL_MAX_LENGTH = 4000
ARTIFACT_LINKS_MAX = 5
ASSUMPTION_MAX_LENGTH = 500


def _sanitize_artifact_links(links: list[str] | None) -> list[str]:
    if not links:
        return []
    cleaned: list[str] = []
    for raw in links[:ARTIFACT_LINKS_MAX]:
        link = raw.strip()
        if link.lower().startswith(("http://", "https://")):
            cleaned.append(link)
    return cleaned


class ExperimentContextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experiment_id: str | None = Field(default=None, max_length=64)
    changed_assumption: str | None = Field(default=None, max_length=ASSUMPTION_MAX_LENGTH)
    artifact_links: list[str] | None = Field(default=None, max_length=ARTIFACT_LINKS_MAX)

    @field_validator("changed_assumption", mode="before")
    @classmethod
    def strip_changed_assumption(cls, value: str | None) -> str | None:
        if value is None or not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None

    @field_validator("artifact_links", mode="before")
    @classmethod
    def sanitize_artifact_links(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = _sanitize_artifact_links(value)
        return cleaned or None


class ExperimentContextResponse(BaseModel):
    experiment_id: str | None = None
    status: Literal["submitted", "reviewed"] = "reviewed"
    changed_assumption: str | None = None
    artifact_links: list[str] = Field(default_factory=list)


class AppealRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    appeal_text: str = Field(
        min_length=10,
        max_length=APPEAL_MAX_LENGTH,
        description="Founder rebuttal to the panel verdict.",
    )
    target_judges: list[str] | None = Field(
        default=None,
        description="Optional judge ids the founder is specifically addressing.",
    )
    experiment_context: ExperimentContextRequest | None = Field(
        default=None,
        description="Optional structured experiment completion metadata.",
    )


class AppealJudgeOutcomeResponse(BaseModel):
    judge: str
    evidence_ask: str
    outcome: str
    targeted: bool
    score_delta: int


class AppealResponse(BaseModel):
    appeal_text: str
    original_panel: dict[str, Any]
    revised_panel: dict[str, Any]
    revised_synthesis: str
    revised_structured_synthesis: dict[str, Any] | None = None
    confidence_before_after: dict[str, Any] | None = None
    experiment_context: ExperimentContextResponse | None = None
    target_judges: list[str] = Field(default_factory=list)
    evidence_outcomes: list[AppealJudgeOutcomeResponse] = Field(default_factory=list)


class VerdictSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    pass_count: int = Field(serialization_alias="pass")
    fail_count: int = Field(serialization_alias="fail")
    conditional_count: int = Field(serialization_alias="conditional")
    avg_score: float | None = None


class RunListItem(BaseModel):
    run_id: str
    status: RunStatus
    idea_preview: str
    created_at: datetime
    workspace_id: str | None = None
    worksheet_version_id: str | None = None
    verdict_summary: VerdictSummary | None = None
    parent_run_id: str | None = None
    version: int = 1


class RunHandoffItem(BaseModel):
    kind: Literal["assumption", "evidence_target", "experiment"]
    title: str
    detail: str
    source_judge: str | None = None


class RunHandoffResponse(BaseModel):
    run_id: str
    workspace_id: str
    items: list[RunHandoffItem] = Field(default_factory=list)


class RunListResponse(BaseModel):
    runs: list[RunListItem]
    total: int
    limit: int
    offset: int


class ResearchFinding(BaseModel):
    title: str
    url: str
    snippet: str


class SimilarRunItem(BaseModel):
    run_id: str
    idea_preview: str
    created_at: datetime
    verdict_summary: VerdictSummary | None = None


class SimilarRunsResponse(BaseModel):
    runs: list[SimilarRunItem]
