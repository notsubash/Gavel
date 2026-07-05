"""Computed confidence chips from evidence and assumption status."""

from __future__ import annotations

from validation.schemas import (
    Assumption,
    ConfidenceChip,
    ConfidenceLabel,
    ConfidenceResponse,
    Evidence,
    IdeaWorksheet,
)

_HUMAN_EVIDENCE = frozenset(
    {"interview_quote", "loi", "payment", "usage", "experiment_metric", "founder_note"}
)


def _demand_label(assumptions: list[Assumption], evidence: list[Evidence]) -> ConfidenceChip:
    demand_assumptions = [a for a in assumptions if a.type == "demand"]
    human = [e for e in evidence if e.type in _HUMAN_EVIDENCE]
    quotes = [e for e in evidence if e.type == "interview_quote"]
    supported = [a for a in demand_assumptions if a.status == "supported"]
    contradicted = [a for a in demand_assumptions if a.status == "contradicted"]

    drivers: list[str] = []
    if contradicted:
        label: ConfidenceLabel = "weak"
        drivers.append("Demand assumption contradicted")
    elif supported or len(quotes) >= 3:
        label = "strong"
        drivers.append(
            f"{len(quotes)} interview quotes" if quotes else "Demand assumption supported"
        )
    elif quotes or human:
        label = "some_signal"
        drivers.append(f"{len(quotes or human)} human evidence item(s)")
    elif demand_assumptions:
        label = "weak"
        drivers.append("Demand assumption still untested")
    else:
        label = "unknown"
        drivers.append("No demand evidence yet")

    return ConfidenceChip(dimension="demand", label=label, drivers=drivers)


def _pricing_label(assumptions: list[Assumption], evidence: list[Evidence]) -> ConfidenceChip:
    payments = [e for e in evidence if e.type in ("payment", "loi")]
    pricing_assumptions = [a for a in assumptions if a.type == "pricing"]

    if payments:
        return ConfidenceChip(
            dimension="pricing",
            label="commitment",
            drivers=[f"{len(payments)} payment/LOI evidence item(s)"],
        )
    if any(a.status == "supported" for a in pricing_assumptions):
        return ConfidenceChip(
            dimension="pricing",
            label="interest",
            drivers=["Pricing assumption has supporting signal"],
        )
    if pricing_assumptions or any(e.type == "interview_quote" for e in evidence):
        return ConfidenceChip(
            dimension="pricing",
            label="interest",
            drivers=["Pricing discussed but no commitment yet"],
        )
    return ConfidenceChip(dimension="pricing", label="unknown", drivers=["No pricing evidence"])


def _competition_label(worksheet: IdeaWorksheet, evidence: list[Evidence]) -> ConfidenceChip:
    research = [e for e in evidence if e.type == "competitor_research"]
    if research and worksheet.competitors:
        return ConfidenceChip(
            dimension="competition",
            label="switching_clear",
            drivers=["Competitors mapped with research notes"],
        )
    if worksheet.competitors:
        return ConfidenceChip(
            dimension="competition",
            label="mapped",
            drivers=[f"{len(worksheet.competitors)} alternative(s) listed"],
        )
    if research:
        return ConfidenceChip(
            dimension="competition",
            label="mapped",
            drivers=["Competitor research logged"],
        )
    return ConfidenceChip(
        dimension="competition", label="unknown", drivers=["No competitor mapping"]
    )


def _moat_label(assumptions: list[Assumption], evidence: list[Evidence]) -> ConfidenceChip:
    moat_assumptions = [a for a in assumptions if a.type == "moat"]
    backed = [a for a in moat_assumptions if a.status == "supported"]
    human = [
        e for e in evidence if e.type in _HUMAN_EVIDENCE and e.strength in ("moderate", "strong")
    ]

    if backed and human:
        return ConfidenceChip(
            dimension="moat",
            label="evidence_backed",
            drivers=["Moat assumption supported by human evidence"],
        )
    if moat_assumptions or any(a.type == "moat" for a in assumptions):
        return ConfidenceChip(
            dimension="moat",
            label="claimed",
            drivers=["Moat hypothesis stated, not yet validated"],
        )
    return ConfidenceChip(dimension="moat", label="unknown", drivers=["No moat evidence"])


def compute_confidence(
    *,
    worksheet: IdeaWorksheet,
    assumptions: list[Assumption],
    evidence: list[Evidence],
) -> ConfidenceResponse:
    chips = [
        _demand_label(assumptions, evidence),
        _pricing_label(assumptions, evidence),
        _competition_label(worksheet, evidence),
        _moat_label(assumptions, evidence),
    ]
    return ConfidenceResponse(chips=chips)
