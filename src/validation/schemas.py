"""Workspace and validation domain models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AssumptionStatus = Literal["untested", "testing", "supported", "contradicted", "retired"]
AssumptionType = Literal["demand", "pricing", "competition", "moat", "channel", "feasibility"]
EvidenceType = Literal[
    "interview_quote",
    "experiment_metric",
    "loi",
    "payment",
    "usage",
    "competitor_research",
    "market_research",
    "ai_research",
    "founder_note",
]
EvidenceStrength = Literal["weak", "moderate", "strong"]
ExperimentDecision = Literal["continue", "revise", "pivot", "kill", "retest", "pending"]
ExperimentStatus = Literal["planned", "active", "completed"]
ValidationStage = Literal[
    "problem_clarity",
    "problem_evidence",
    "solution_evidence",
    "willingness_to_pay",
    "channel",
    "competition_moat",
]
WorkspaceLifecycle = Literal[
    "draft", "discovery", "testing", "evidence_ready", "judged", "iterating"
]
ReadinessLevel = Literal["too_vague", "speculative", "ready"]
ConfidenceLabel = Literal[
    "unknown",
    "weak",
    "some_signal",
    "strong",
    "interest",
    "commitment",
    "mapped",
    "switching_clear",
    "claimed",
    "evidence_backed",
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
    """Lifecycle is derived from validation state; PATCH reserved for future metadata."""

    model_config = ConfigDict(extra="forbid")


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


class Experiment(BaseModel):
    id: str
    workspace_id: str
    title: str = Field(min_length=1, max_length=200)
    hypothesis: str = Field(min_length=10, max_length=2000)
    assumption_id: str | None = None
    method: str | None = Field(default=None, max_length=1000)
    target: str | None = Field(default=None, max_length=1000)
    pass_fail_threshold: str | None = Field(default=None, max_length=1000)
    start_date: str | None = None
    due_date: str | None = None
    result: str | None = Field(default=None, max_length=4000)
    decision: ExperimentDecision = "pending"
    status: ExperimentStatus = "planned"
    worksheet_version_id: str | None = None


class Evidence(BaseModel):
    id: str
    workspace_id: str
    type: EvidenceType
    strength: EvidenceStrength = "weak"
    source: str | None = Field(default=None, max_length=500)
    content: str = Field(min_length=1, max_length=8000)
    occurred_at: datetime | None = None
    assumption_ids: list[str] = Field(default_factory=list)
    experiment_id: str | None = None
    worksheet_version_id: str | None = None


class InterviewNote(BaseModel):
    id: str
    workspace_id: str
    person_label: str = Field(min_length=1, max_length=200)
    segment: str | None = Field(default=None, max_length=500)
    occurred_at: datetime | None = None
    context: str | None = Field(default=None, max_length=2000)
    notes: str = Field(min_length=1, max_length=12000)
    quotes: list[str] = Field(default_factory=list)
    workaround: str | None = Field(default=None, max_length=2000)
    pain_cost: str | None = Field(default=None, max_length=2000)
    objections: str | None = Field(default=None, max_length=2000)
    assumption_ids: list[str] = Field(default_factory=list)
    ai_summary: str | None = Field(default=None, max_length=4000)


class ValidationChecklistItem(BaseModel):
    stage: ValidationStage
    label: str
    completed: bool = False
    completed_at: datetime | None = None
    auto_completed: bool = False


class ChecklistResponse(BaseModel):
    items: list[ValidationChecklistItem]
    next_action: str
    next_stage: ValidationStage | None = None


class ConfidenceChip(BaseModel):
    dimension: Literal["demand", "pricing", "competition", "moat"]
    label: ConfidenceLabel
    drivers: list[str] = Field(default_factory=list)


class ConfidenceResponse(BaseModel):
    chips: list[ConfidenceChip]


class ReadinessCheck(BaseModel):
    name: str
    passed: bool
    detail: str | None = None


class ReadinessResponse(BaseModel):
    level: ReadinessLevel
    checks: list[ReadinessCheck]
    can_run_judges: bool


class ValidationOverviewResponse(BaseModel):
    checklist: ChecklistResponse
    confidence: ConfidenceResponse
    readiness: ReadinessResponse
    active_experiment: Experiment | None = None
    top_assumptions: list[Assumption] = Field(default_factory=list)


class CreateAssumptionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    statement: str = Field(min_length=10, max_length=500)
    type: AssumptionType = "demand"
    disconfirming_criteria: str | None = Field(default=None, max_length=500)
    worksheet_version_id: str | None = None


class UpdateAssumptionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    statement: str | None = Field(default=None, min_length=10, max_length=500)
    type: AssumptionType | None = None
    status: AssumptionStatus | None = None
    confidence: float | None = None
    disconfirming_criteria: str | None = None
    sort_order: int | None = None


class CreateExperimentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    hypothesis: str = Field(min_length=10, max_length=2000)
    assumption_id: str | None = None
    method: str | None = Field(default=None, max_length=1000)
    target: str | None = Field(default=None, max_length=1000)
    pass_fail_threshold: str | None = Field(default=None, max_length=1000)
    start_date: str | None = None
    due_date: str | None = None
    status: ExperimentStatus = "planned"


class UpdateExperimentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    hypothesis: str | None = Field(default=None, min_length=10, max_length=2000)
    assumption_id: str | None = None
    method: str | None = None
    target: str | None = None
    pass_fail_threshold: str | None = None
    start_date: str | None = None
    due_date: str | None = None
    result: str | None = None
    decision: ExperimentDecision | None = None
    status: ExperimentStatus | None = None


class CreateEvidenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: EvidenceType
    strength: EvidenceStrength = "weak"
    source: str | None = Field(default=None, max_length=500)
    content: str = Field(min_length=1, max_length=8000)
    occurred_at: datetime | None = None
    assumption_ids: list[str] = Field(default_factory=list)
    experiment_id: str | None = None
    worksheet_version_id: str | None = None


class UpdateEvidenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: EvidenceType | None = None
    strength: EvidenceStrength | None = None
    source: str | None = None
    content: str | None = Field(default=None, min_length=1, max_length=8000)
    occurred_at: datetime | None = None
    assumption_ids: list[str] | None = None
    experiment_id: str | None = None


class CreateInterviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    person_label: str = Field(min_length=1, max_length=200)
    segment: str | None = Field(default=None, max_length=500)
    occurred_at: datetime | None = None
    context: str | None = Field(default=None, max_length=2000)
    notes: str = Field(min_length=1, max_length=12000)
    quotes: list[str] = Field(default_factory=list)
    workaround: str | None = Field(default=None, max_length=2000)
    pain_cost: str | None = Field(default=None, max_length=2000)
    objections: str | None = Field(default=None, max_length=2000)
    assumption_ids: list[str] = Field(default_factory=list)
    ai_summary: str | None = Field(default=None, max_length=4000)


class UpdateInterviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    person_label: str | None = Field(default=None, min_length=1, max_length=200)
    segment: str | None = None
    occurred_at: datetime | None = None
    context: str | None = None
    notes: str | None = Field(default=None, min_length=1, max_length=12000)
    quotes: list[str] | None = None
    workaround: str | None = None
    pain_cost: str | None = None
    objections: str | None = None
    assumption_ids: list[str] | None = None
    ai_summary: str | None = None


class SuggestInterviewQuestionsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assumption_id: str | None = None


class InterviewQuestion(BaseModel):
    question: str
    rationale: str


class SuggestInterviewQuestionsResponse(BaseModel):
    questions: list[InterviewQuestion]


class SuggestExperimentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assumption_id: str | None = None
    checklist_stage: ValidationStage | None = None


class SuggestExperimentResponse(BaseModel):
    experiment: CreateExperimentRequest


class SummarizeInterviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: str = Field(min_length=20, max_length=12000)
    person_label: str | None = None
    segment: str | None = None


class SummarizeInterviewResponse(BaseModel):
    summary: str
    extracted_quotes: list[str] = Field(default_factory=list)
    suggested_assumption_ids: list[str] = Field(default_factory=list)


class MapEvidenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=10, max_length=8000)
    type: EvidenceType
    assumption_ids: list[str] = Field(default_factory=list)


class MapEvidenceResponse(BaseModel):
    suggested_assumption_ids: list[str] = Field(default_factory=list)
    rationale: str | None = None


class ValidationCoachResponse(BaseModel):
    narrative: str
    suggested_actions: list[str] = Field(default_factory=list)
    focus_stage: ValidationStage | None = None


PatchableFieldName = Literal[
    "audience",
    "problem_statement",
    "current_workaround",
    "solution_statement",
    "secret_sauce",
    "pricing_hypothesis",
    "existing_evidence",
    "top_risky_assumption",
    "disconfirming_evidence",
]


class WorksheetFieldChange(BaseModel):
    field: str
    label: str
    before: str
    after: str
    is_core: bool = False


class WorksheetVersionDiffResponse(BaseModel):
    from_version_id: str
    to_version_id: str
    changes: list[WorksheetFieldChange]
    change_summary: str | None = None


class CreateWorksheetVersionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worksheet: IdeaWorksheet
    minor_edit: bool = False
    change_summary: str | None = Field(default=None, max_length=500)
    base_version_id: str | None = None


class CreateWorksheetVersionResponse(BaseModel):
    version: WorksheetVersion
    created: bool
    diff: list[WorksheetFieldChange] = Field(default_factory=list)


class WorksheetFieldPatch(BaseModel):
    field_name: PatchableFieldName
    suggested_value: str = Field(min_length=1, max_length=4000)
    rationale: str = Field(min_length=10, max_length=1000)


class ReviseFromEvidenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experiment_id: str | None = None


class ReviseFromEvidenceResponse(BaseModel):
    patches: list[WorksheetFieldPatch] = Field(default_factory=list)
    summary: str
