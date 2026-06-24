"""Phase 1: parallel judge panel with event streaming."""

from collections.abc import Iterator
import concurrent.futures

from config import JUDGE_ORDER
from events import JudgesDispatched, JudgeVerdictCompleted, RoastPanelCompleted
from judges.schemas import RoastPanel, Verdict
from judges.service import invoke_judge
from observability import build_run_config, idea_fingerprint, traceable


def stream_roast_panel(
    model,
    startup_idea: str,
    memory_context: str | None = None,
    research_context: str | None = None,
    run_config: dict | None = None,
) -> Iterator[JudgeVerdictCompleted | JudgesDispatched | RoastPanelCompleted]:
    """Run all judges in parallel; yield events as each completes."""
    total = len(JUDGE_ORDER)
    yield JudgesDispatched(total=total)
    resolved_config = run_config or build_run_config(
        "roast-panel",
        tags=["phase:roast"],
        metadata={"idea_fingerprint": idea_fingerprint(startup_idea)},
    )

    with concurrent.futures.ThreadPoolExecutor(max_workers=total) as pool:
        future_to_judge = {
            pool.submit(
                invoke_judge,
                model,
                judge,
                startup_idea,
                memory_context,
                research_context,
                resolved_config,
            ): judge
            for judge in JUDGE_ORDER
        }

        results: dict[str, Verdict] = {}
        completed = 0
        for future in concurrent.futures.as_completed(future_to_judge):
            judge = future_to_judge[future]
            verdict = future.result()
            results[judge] = verdict
            completed += 1
            yield JudgeVerdictCompleted(
                judge=judge,
                verdict=verdict,
                completed=completed,
                total=total,
            )

    verdicts = [results[judge] for judge in JUDGE_ORDER]
    panel = RoastPanel(verdicts=verdicts)
    yield RoastPanelCompleted(panel=panel)


@traceable(name="run_roast_panel", run_type="chain", tags=["phase:roast"])
def run_roast_panel(
    model,
    startup_idea: str,
    memory_context: str | None = None,
    research_context: str | None = None,
    run_config: dict | None = None,
) -> RoastPanel:
    """Blocking convenience wrapper — returns the final panel."""
    panel = None
    for event in stream_roast_panel(
        model,
        startup_idea,
        memory_context,
        research_context,
        run_config=run_config,
    ):
        if isinstance(event, RoastPanelCompleted):
            panel = event.panel
    assert panel is not None
    return panel
