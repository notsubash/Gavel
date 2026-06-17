"""Deterministic two-phase pipeline — the production execution path.

Phase 1: parallel structured judge calls (ThreadPoolExecutor)
Phase 2: LangGraph debate graph (fixed turn order)

DeepAgents orchestrator is NOT used here. Local models often fail to
reliably dispatch all five judge subagents via task(); debate routing
must be deterministic, not LLM-planned.
"""

from collections.abc import Iterator

from debate.service import run_debate, stream_debate
from events import (
    DebateCompleted,
    PhaseStarted,
    PipelineCompleted,
    PipelineEvent,
    RoastPanelCompleted,
)
from judges.panel import run_roast_panel, stream_roast_panel
from judges.schemas import RoastPanel


def stream_pipeline(
    model,
    startup_idea: str,
    max_debate_rounds: int = 3,
) -> Iterator[PipelineEvent]:
    """Run roast panel then debate, yielding all intermediate events."""
    yield PhaseStarted(phase="roast")

    roast_panel: RoastPanel | None = None
    for event in stream_roast_panel(model, startup_idea):
        yield event
        if isinstance(event, RoastPanelCompleted):
            roast_panel = event.panel

    if roast_panel is None:
        raise RuntimeError("Roast panel did not complete")

    yield PhaseStarted(phase="debate")

    debate_result: dict | None = None
    for event in stream_debate(model, startup_idea, roast_panel, max_debate_rounds):
        yield event
        if isinstance(event, DebateCompleted):
            debate_result = {
                "debate_messages": event.debate_messages,
                "final_synthesis": event.final_synthesis,
            }

    if debate_result is None:
        raise RuntimeError("Debate did not complete")

    yield PipelineCompleted(roast_panel=roast_panel, debate_result=debate_result)


def run_pipeline(model, startup_idea: str, max_debate_rounds: int = 3) -> tuple[RoastPanel, dict]:
    """Blocking convenience wrapper for CLI and tests."""
    roast_panel = run_roast_panel(model, startup_idea)
    debate_result = run_debate(model, startup_idea, roast_panel, max_debate_rounds)
    return roast_panel, debate_result
