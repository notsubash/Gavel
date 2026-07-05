"""On-demand competitor scan via Tavily web search."""

from __future__ import annotations

import os

from config import get_settings
from research.service import TavilyHttpClient, build_research_context, format_research_context
from validation.schemas import CompetitorFinding, CompetitorScanResponse, IdeaWorksheet


def competitor_scan(worksheet: IdeaWorksheet) -> CompetitorScanResponse:
    """Search for competitor signals; returns draft evidence, does not persist."""
    tavily_key = os.getenv("TAVILY_API_KEY")
    if not tavily_key:
        return CompetitorScanResponse(
            query=None,
            findings=[],
            suggested_evidence=(
                "Web search unavailable (TAVILY_API_KEY not set). "
                "Add competitors manually or enable Tavily."
            ),
            available=False,
        )

    settings = get_settings()
    if not settings.enable_web_search:
        return CompetitorScanResponse(
            query=None,
            findings=[],
            suggested_evidence=(
                "Web search is disabled (ENABLE_WEB_SEARCH=false). Add competitor notes manually."
            ),
            available=False,
        )

    idea_text = (
        f"{worksheet.working_name}: {worksheet.solution_statement} "
        f"for {worksheet.audience}. Competitors: {', '.join(worksheet.competitors) or 'unknown'}."
    )
    client = TavilyHttpClient(tavily_key)
    try:
        context = build_research_context(
            idea_text,
            client,
            max_results=settings.web_search_max_results,
            enabled=settings.enable_web_search,
            force=True,
        )
    except Exception:
        # ponytail: bad/missing Tavily key — return draft note instead of 500.
        return CompetitorScanResponse(
            query=None,
            findings=[],
            suggested_evidence="Web search failed. Add competitor notes manually.",
            available=False,
        )
    if context is None or not context.findings:
        return CompetitorScanResponse(
            query=None,
            findings=[],
            suggested_evidence="No competitor signals found in web search.",
            available=True,
        )

    findings = [
        CompetitorFinding(title=f.title, url=f.url, snippet=f.content[:260].strip())
        for f in context.findings
    ]
    return CompetitorScanResponse(
        query=context.query,
        findings=findings,
        suggested_evidence=format_research_context(context),
        available=True,
    )
