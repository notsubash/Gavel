"""Phase 2: LangGraph debate — deterministic turn order, event streaming."""

from collections.abc import Iterator
from typing import Any

from langchain_core.messages import HumanMessage

from config import JUDGE_ORDER
from debate.graph import build_debate_graph
from events import (
    DebateCompleted,
    DebateMessagePublished,
    DebateRoundStarted,
    DebateSpeakerThinking,
    DebateSynthesisPublished,
)
from judges.schemas import RoastPanel


def _initial_state(startup_idea: str, roast_panel: RoastPanel, max_rounds: int) -> dict:
    return {
        "messages": [HumanMessage(content="Begin the debate.")],
        "startup_idea": startup_idea,
        "verdicts": [v.model_dump() for v in roast_panel.verdicts],
        "debate_messages": [],
        "round": 1,
        "max_rounds": max_rounds,
        "current_speaker_idx": 0,
        "final_synthesis": None,
    }


def stream_debate(
    model,
    startup_idea: str,
    roast_panel: RoastPanel,
    max_rounds: int = 3,
) -> Iterator[
    DebateRoundStarted
    | DebateSpeakerThinking
    | DebateMessagePublished
    | DebateSynthesisPublished
    | DebateCompleted
]:
    """Stream debate graph node updates as frontend-agnostic events."""
    debate_graph = build_debate_graph(model)
    initial_state = _initial_state(startup_idea, roast_panel, max_rounds)

    current_round_displayed = 0
    all_debate_messages: list[dict] = []
    final_synthesis: str | None = None

    for state_update in debate_graph.stream(initial_state, stream_mode="updates"):
        for node_name, node_output in state_update.items():
            if node_name in ("__start__", "advance_round"):
                continue

            new_messages = node_output.get("debate_messages", [])
            for msg in new_messages:
                all_debate_messages.append(msg)
                if msg["speaker"] == "moderator":
                    continue

                msg_round = msg["round"]
                if msg_round != current_round_displayed:
                    current_round_displayed = msg_round
                    yield DebateRoundStarted(round=current_round_displayed)

                yield DebateMessagePublished(
                    speaker=msg["speaker"],
                    round=msg["round"],
                    content=msg["content"],
                )

            synthesis = node_output.get("final_synthesis")
            if synthesis:
                final_synthesis = synthesis
                yield DebateSynthesisPublished(content=synthesis)
            else:
                next_idx = node_output.get("current_speaker_idx", 0)
                if next_idx < len(JUDGE_ORDER):
                    yield DebateSpeakerThinking(
                        judge=JUDGE_ORDER[next_idx],
                        round=current_round_displayed or 1,
                    )

    yield DebateCompleted(
        debate_messages=all_debate_messages,
        final_synthesis=final_synthesis,
    )


def run_debate(
    model,
    startup_idea: str,
    roast_panel: RoastPanel,
    max_rounds: int = 3,
) -> dict[str, Any]:
    """Blocking convenience wrapper — returns the final debate state dict."""
    result: dict[str, Any] = {}
    for event in stream_debate(model, startup_idea, roast_panel, max_rounds):
        if isinstance(event, DebateCompleted):
            result = {
                "debate_messages": event.debate_messages,
                "final_synthesis": event.final_synthesis,
            }
    return result
