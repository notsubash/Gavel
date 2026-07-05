"""Post-roast handoff items for workspace validation tasks."""

from __future__ import annotations

from api.schemas import RunHandoffItem
from judges.schemas import RoastPanel
from judges.synthesis import parse_structured_synthesis


def _dedupe(items: list[RunHandoffItem]) -> list[RunHandoffItem]:
    seen: set[tuple[str, str]] = set()
    out: list[RunHandoffItem] = []
    for item in items:
        key = (item.kind, item.title.strip().lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def build_run_handoff(
    *,
    roast_panel: RoastPanel,
    debate_result: dict | None,
) -> list[RunHandoffItem]:
    items: list[RunHandoffItem] = []
    synthesis = parse_structured_synthesis(debate_result)

    for problem in synthesis.top_problems if synthesis else []:
        text = problem.strip()
        if text:
            items.append(RunHandoffItem(kind="assumption", title=text, detail=text))

    for verdict in roast_panel.verdicts:
        ask = (verdict.evidence_to_change_verdict or "").strip()
        if ask:
            items.append(
                RunHandoffItem(
                    kind="evidence_target",
                    title=ask,
                    detail=ask,
                    source_judge=verdict.judge.value,
                )
            )
        fix = (verdict.recommended_fix or "").strip()
        if fix:
            items.append(
                RunHandoffItem(
                    kind="experiment",
                    title=fix,
                    detail=fix,
                    source_judge=verdict.judge.value,
                )
            )

    if synthesis and synthesis.recommended_experiment:
        exp = synthesis.recommended_experiment
        items.append(
            RunHandoffItem(
                kind="experiment",
                title=exp.title,
                detail=exp.hypothesis,
            )
        )

    return _dedupe(items)[:12]
