"""Deterministic run pipeline for browser E2E — only used when E2E_TEST_MODE=true."""

from __future__ import annotations

from collections.abc import Callable, Iterator
import time
from typing import Any

from appeal.coaching import appeal_judge_outcomes, normalize_target_judges
from appeal.service import AppealResult
from config import JUDGE_ORDER
from events import (
    DebateCompleted,
    DebateMessagePublished,
    DebateRoundStarted,
    DebateTokenDelta,
    JudgesDispatched,
    JudgeVerdictCompleted,
    PhaseStarted,
    PipelineCompleted,
    RoastPanelCompleted,
    RunMetrics,
)
from judges.schemas import RoastPanel, Verdict, VerdictLabel
from judges.synthesis import (
    ConfidenceLevel,
    OverallRecommendation,
    Synthesis,
    synthesis_to_prose,
)

# Visible in browser E2E assertions — not a secret, just a stable marker.
E2E_STUB_MARKER = "E2E stub verdict"

_STUB_SCORES = {"vc": 5, "engineer": 6, "pm": 5, "customer": 4, "competitor": 5}


def _stub_verdict(judge: str) -> Verdict:
    return Verdict(
        judge=judge,
        verdict=VerdictLabel.CONDITIONAL,
        roast=(
            f"{E2E_STUB_MARKER}: The idea shows promise but needs clearer buyer evidence "
            "before scaling distribution spend."
        ),
        score=_STUB_SCORES[judge],
        key_concern="Founders need stronger validation signals from paying customers.",
        recommended_fix="Run five structured interviews with qualified buyers this week.",
        evidence_to_change_verdict="Three signed LOIs or paid pilots from the target ICP.",
        evidence_quality="moderate",
    )


def stub_roast_panel() -> RoastPanel:
    return RoastPanel(verdicts=[_stub_verdict(judge) for judge in JUDGE_ORDER])


def _stub_structured_synthesis() -> dict[str, Any]:
    synthesis = Synthesis(
        overall_recommendation=OverallRecommendation.ITERATE,
        confidence=ConfidenceLevel.MEDIUM,
        top_strengths=["Clear founder pain around validation discipline."],
        top_risks=[
            "Buyer urgency is still unproven in live conversations.",
            "Distribution may be slower than the pitch assumes.",
        ],
        top_problems=[
            "Buyer urgency is still unproven in live conversations.",
            "Distribution may be slower than the pitch assumes.",
            "Incumbents can copy the workflow once traction appears.",
        ],
        highest_priority="Prove that target buyers will pay before the next build sprint.",
        biggest_disagreement="The VC wants a narrower wedge while the PM wants broader TAM.",
        recommended_experiment={
            "title": "Run five buyer interviews with qualified founders this week.",
            "audience": "Solo technical founders in early validation",
            "hypothesis": "Buyers rank validation workflow as a top-three weekly pain.",
            "questions": [
                "Do they rank validation in their top three pains unprompted?",
                "What tools do they use today?",
                "Would they pilot a workflow that saves one hour per week?",
            ],
            "effort_minutes": 120,
        },
    )
    return synthesis.model_dump(mode="json")


def _stub_debate_result() -> dict[str, Any]:
    synthesis = _stub_structured_synthesis()
    structured = Synthesis.model_validate(synthesis)
    return {
        "debate_messages": [
            {
                "speaker": "vc",
                "round": 1,
                "content": "The moat is thin until founders show repeat weekly usage.",
            },
            {
                "speaker": "customer",
                "round": 1,
                "content": "I would pay only after seeing proof this beats my spreadsheet.",
            },
        ],
        "final_synthesis": synthesis_to_prose(structured),
        "structured_synthesis": synthesis,
        "initial_verdicts": [v.model_dump(mode="json") for v in stub_roast_panel().verdicts],
        "revised_verdicts": None,
    }


def _pause(abort_check: Callable[[], str | None] | None) -> None:
    if abort_check is not None and abort_check() is not None:
        from run_control import RunAbort

        reason = abort_check()
        raise RunAbort(reason or "cancelled")
    # ponytail: tiny yield so cancel + mid-stream reload tests can interleave
    time.sleep(0.05)


def stream_e2e_stub_pipeline(
    *,
    max_debate_rounds: int = 3,
    model_runtime: str = "deepseek",
    abort_check: Callable[[], str | None] | None = None,
    **_kwargs: Any,
) -> Iterator[Any]:
    """Emit the deterministic SSE sequence required by the E2E plan."""
    panel = stub_roast_panel()
    debate_result = _stub_debate_result()
    rounds = max(1, min(5, max_debate_rounds))

    yield PhaseStarted(phase="roast")
    _pause(abort_check)

    yield JudgesDispatched(total=len(JUDGE_ORDER))
    for index, judge in enumerate(JUDGE_ORDER, start=1):
        _pause(abort_check)
        yield JudgeVerdictCompleted(
            judge=judge,
            verdict=_stub_verdict(judge),
            completed=index,
            total=len(JUDGE_ORDER),
        )

    yield RoastPanelCompleted(panel=panel)
    _pause(abort_check)

    yield PhaseStarted(phase="debate")
    for round_num in range(1, rounds + 1):
        _pause(abort_check)
        yield DebateRoundStarted(round=round_num)
        message = (
            "The moat is thin until founders show repeat weekly usage."
            if round_num == 1
            else "Distribution still looks expensive without a sharper wedge."
        )
        speaker = "vc" if round_num % 2 == 1 else "customer"
        yield DebateTokenDelta(speaker=speaker, round=round_num, delta=message[:12])
        _pause(abort_check)
        yield DebateTokenDelta(speaker=speaker, round=round_num, delta=message[12:])
        _pause(abort_check)
        yield DebateMessagePublished(speaker=speaker, round=round_num, content=message)

    debate_result["debate_messages"] = [
        {"speaker": "vc", "round": 1, "content": debate_result["debate_messages"][0]["content"]},
        *debate_result["debate_messages"][1:],
    ]
    yield DebateCompleted(**debate_result)
    _pause(abort_check)

    yield RunMetrics(
        roast_seconds=0.4,
        debate_seconds=0.6,
        total_seconds=1.0,
        input_tokens=0,
        output_tokens=0,
        total_tokens=0,
        estimated_cost_usd=0.0,
        model_runtime=model_runtime,
        judge_calls=[],
        debate_calls=[],
    )
    yield PipelineCompleted(roast_panel=panel, debate_result=debate_result)


def run_e2e_stub_appeal(
    roast_panel: RoastPanel,
    debate_result: dict,
    appeal_text: str,
    target_judges: list[str] | None = None,
) -> AppealResult:
    """Deterministic appeal outcome — no model calls."""
    appeal_text = appeal_text.strip()
    if not appeal_text:
        raise ValueError("Appeal text is required")

    resolved = normalize_target_judges(target_judges)
    revised_verdicts: list[Verdict] = []
    for verdict in roast_panel.verdicts:
        score = verdict.score
        label = verdict.verdict
        if verdict.judge.value in resolved:
            score = min(10, score + 2)
            label = VerdictLabel.PASS if score >= 7 else VerdictLabel.CONDITIONAL
        revised_verdicts.append(
            verdict.model_copy(
                update={
                    "score": score,
                    "verdict": label,
                    "roast": (
                        f"{E2E_STUB_MARKER} appeal: founder evidence shifted this lens "
                        f"toward a more favorable read."
                    ),
                }
            )
        )

    revised_panel = RoastPanel(verdicts=revised_verdicts)
    structured = _stub_structured_synthesis()
    structured["overall_recommendation"] = OverallRecommendation.GO.value
    structured["confidence"] = ConfidenceLevel.HIGH.value
    revised_synthesis = (
        f"{E2E_STUB_MARKER} appeal synthesis: the panel moved toward GO after new evidence."
    )
    return AppealResult(
        revised_panel=revised_panel,
        revised_synthesis=revised_synthesis,
        revised_structured_synthesis=structured,
        target_judges=resolved,
        evidence_outcomes=tuple(appeal_judge_outcomes(roast_panel, revised_panel, resolved)),
    )
