"""Workspace and validation domain models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AssumptionStatus = Literal["untested", "testing", "supported", "contradicted", "retired"]
AssumptionType = Literal["demand", "pricing", "competition", "moat", "channel", "feasibility"]
WorkspaceLifecycle = Literal[
    "draft", "discovery", "testing", "evidence_ready", "judged", "iterating"
]


class IdeaWorksheet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    working_name: str = Field(min_length=1, max_length=120)
    audience: str = Field(min_length=10, max_length=2000)
    problem_statement: str = Field(min_length=10, max_length=4000)
    current_workaround: str = Field(min_length=10, max_length=4000)
    solution_statement: str = Field(min_length=10, max_length=4000)
    secret_sauce: str = Field(min_length=10, max_length=2000)
    pricing_hypothesis: str = Field(max_length=2000)
    existing_evidence: str = Field(max_length=4000)
    competitors: list[str] = Field(default_factory=list, max_length=20)
    top_risky_assumption: str = Field(min_length=10, max_length=1000)
    disconfirming_evidence: str = Field(min_length=10, max_length=2000)
    trigger_event: str | None = Field(default=None, max_length=1000)


class Workspace(BaseModel):
    id: str
    lifecycle: WorkspaceLifecycle = "draft"
    current_version_id: str | None = None
    created_at: datetime
    updated_at: datetime


class WorksheetVersion(BaseModel):
    id: str
    workspace_id: str
    version: int
    worksheet: IdeaWorksheet
    generated_document: str
    change_summary: str | None = None
    parent_version_id: str | None = None
    created_at: datetime


class Assumption(BaseModel):
    id: str
    workspace_id: str
    statement: str = Field(min_length=10, max_length=500)
    type: AssumptionType = "demand"
    status: AssumptionStatus = "untested"
    confidence: float = 0.0
    disconfirming_criteria: str | None = None
    worksheet_version_id: str | None = None
    sort_order: int = 0


class CreateWorkspaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worksheet: IdeaWorksheet


class UpdateWorkspaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lifecycle: WorkspaceLifecycle | None = None


class WorkspaceListItem(BaseModel):
    id: str
    working_name: str
    lifecycle: WorkspaceLifecycle
    created_at: datetime
    updated_at: datetime
    assumption_count: int = 0


class WorkspaceListResponse(BaseModel):
    workspaces: list[WorkspaceListItem]
    total: int
    limit: int
    offset: int


class WorkspaceDetailResponse(BaseModel):
    workspace: Workspace
    current_version: WorksheetVersion
    assumptions: list[Assumption] = Field(default_factory=list)


class DraftFromNotesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: str = Field(min_length=20, max_length=12000)


class DraftFromNotesResponse(BaseModel):
    worksheet: IdeaWorksheet
    ai_drafted_fields: list[str] = Field(default_factory=list)


class ClarifyFieldRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_name: Literal[
        "working_name",
        "audience",
        "problem_statement",
        "current_workaround",
        "solution_statement",
        "secret_sauce",
        "pricing_hypothesis",
        "existing_evidence",
        "top_risky_assumption",
        "disconfirming_evidence",
        "trigger_event",
    ]
    current_value: str
    worksheet_context: IdeaWorksheet | None = None


class ClarifyFieldResponse(BaseModel):
    field_name: str
    clarified_value: str


class ExtractAssumptionsResponse(BaseModel):
    assumptions: list[Assumption]


class PersistAssumptionsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assumptions: list[Assumption]
