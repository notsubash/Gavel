"""Bundled sample workspace for empty-state onboarding."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from api.workspace_store import WorkspaceStore
from validation.schemas import (
    CreateAssumptionRequest,
    CreateEvidenceRequest,
    CreateExperimentRequest,
    CreateInterviewRequest,
    IdeaWorksheet,
    UpdateAssumptionRequest,
    WorkspaceDetailResponse,
)

SAMPLE_WORKSHEET = IdeaWorksheet(
    working_name="Validation OS",
    audience="Solo technical founders building paid SaaS before they have revenue.",
    problem_statement="have trouble proving buyer demand before they build.",
    current_workaround="They use Notion docs, ChatGPT, and spreadsheets.",
    solution_statement=(
        "I am developing a local-first founder workbench to help solo founders "
        "turn startup ideas into validation experiments."
    ),
    secret_sauce="Five harsh AI judges plus a persistent evidence ledger.",
    pricing_hypothesis="$19 to $49 one-time self-hosted license.",
    existing_evidence="Three founders asked for a validation template.",
    competitors=["ChatGPT", "Notion templates", "Doing nothing"],
    top_risky_assumption="Solo founders will return weekly to update validation evidence.",
    disconfirming_evidence="Five founders say ChatGPT plus Notion is enough.",
)


def seed_sample_workspace(store: WorkspaceStore) -> WorkspaceDetailResponse:
    """Create a demo workspace showing the full validation loop."""
    workspace, version, primary = store.create_workspace(SAMPLE_WORKSHEET)
    ws_id = workspace.id
    version_id = version.id
    now = datetime.now(UTC)
    week_ago = now - timedelta(days=3)

    store.create_assumption(
        ws_id,
        CreateAssumptionRequest(
            statement="Founders will pay $29 for a self-hosted validation workbench.",
            type="pricing",
            disconfirming_criteria="Three founders decline after seeing price.",
            worksheet_version_id=version_id,
        ),
    )
    store.update_assumption(
        ws_id,
        primary.id,
        UpdateAssumptionRequest(status="testing"),
    )

    store.create_interview(
        ws_id,
        CreateInterviewRequest(
            person_label="Alex — solo SaaS founder",
            segment="Pre-revenue technical founder",
            notes=(
                "Spends 6+ hours weekly copying judge feedback into Notion. "
                "Wants one place for assumptions and evidence before another roast."
            ),
            occurred_at=week_ago,
            assumption_ids=[primary.id],
        ),
    )
    store.create_evidence(
        ws_id,
        CreateEvidenceRequest(
            type="interview_quote",
            strength="moderate",
            source="Alex interview",
            content="I keep re-explaining the same idea because my notes are scattered.",
            occurred_at=week_ago,
            assumption_ids=[primary.id],
            worksheet_version_id=version_id,
        ),
    )
    store.create_evidence(
        ws_id,
        CreateEvidenceRequest(
            type="founder_note",
            strength="weak",
            content="Two Twitter DMs asked for a structured validation worksheet export.",
            occurred_at=week_ago,
            worksheet_version_id=version_id,
        ),
    )
    store.create_experiment(
        ws_id,
        CreateExperimentRequest(
            title="Landing page smoke test",
            hypothesis="10+ founders sign up for a validation worksheet waitlist in 7 days.",
            assumption_id=primary.id,
            method="Single-page waitlist with worksheet preview PDF.",
            target="Solo founders on Indie Hackers and X",
            pass_fail_threshold="≥10 emails from ICP segment",
            status="active",
        ),
    )
    store.sync_lifecycle(ws_id)

    workspace = store.get_workspace(ws_id)
    version = store.get_current_version(ws_id)
    assumptions = store.list_assumptions(ws_id)
    assert workspace is not None and version is not None
    return WorkspaceDetailResponse(
        workspace=workspace,
        current_version=version,
        assumptions=assumptions,
    )
