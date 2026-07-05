"""On-demand competitor scan via Tavily Research (mini)."""

from __future__ import annotations

import logging
import os

from config import get_settings
from research.service import TavilyHttpClient, run_tavily_research
from validation.llm.competitor_intel import _heuristic_intel, _scrub_intel_sources
from validation.llm.prompts import render_validation_prompt
from validation.schemas import (
    CompetitorFinding,
    CompetitorScanIntel,
    CompetitorScanResponse,
    IdeaWorksheet,
)

logger = logging.getLogger(__name__)

_EXCLUDE_DOMAINS = ["youtube.com", "youtu.be"]


def _research_input(worksheet: IdeaWorksheet) -> str:
    competitors = [c.strip() for c in worksheet.competitors if c.strip()]
    return render_validation_prompt(
        "competitor_scan_research.jinja2",
        working_name=worksheet.working_name.strip(),
        solution_statement=worksheet.solution_statement.strip(),
        audience=worksheet.audience.strip(),
        competitors=competitors,
    ).strip()


def _research_output_schema() -> dict:
    return {
        "properties": {
            "rows": {
                "type": "array",
                "description": (
                    "One row per competitor name from the worksheet. "
                    "Only cite source_url from web sources found during research."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "competitor": {
                            "type": "string",
                            "description": "Competitor name matching the worksheet.",
                        },
                        "positioning": {
                            "type": "string",
                            "description": "What they offer that overlaps this idea (factual, short).",
                        },
                        "gap_vs_us": {
                            "type": "string",
                            "description": "One sentence on differentiation or unknown; omit if unclear.",
                        },
                        "source_url": {
                            "type": "string",
                            "description": "URL from research sources only.",
                        },
                        "source_title": {
                            "type": "string",
                            "description": "Title of the cited source.",
                        },
                        "signal_strength": {
                            "type": "string",
                            "description": 'Evidence strength: "strong", "weak", or "none".',
                        },
                    },
                    "required": ["competitor", "positioning", "signal_strength"],
                },
            },
            "overall_gap": {
                "type": "string",
                "description": (
                    "Where this idea could win vs the competitor set, or what is still unknown."
                ),
            },
        },
        "required": ["rows", "overall_gap"],
    }


def _sources_to_findings(sources: list[dict]) -> list[CompetitorFinding]:
    findings: list[CompetitorFinding] = []
    for row in sources:
        url = str(row.get("url") or "").strip()
        if not url:
            continue
        title = str(row.get("title") or "Untitled source").strip()
        findings.append(CompetitorFinding(title=title, url=url, snippet=title))
    return findings


def _format_intel_evidence(worksheet: IdeaWorksheet, intel: CompetitorScanIntel) -> str:
    return render_validation_prompt(
        "competitor_scan_evidence.jinja2",
        working_name=worksheet.working_name.strip(),
        intel=intel.rows,
        overall_gap=intel.overall_gap,
    ).strip()


def _parse_research_intel(
    content: object,
    worksheet: IdeaWorksheet,
    findings: list[CompetitorFinding],
) -> CompetitorScanIntel:
    if isinstance(content, dict):
        try:
            intel = CompetitorScanIntel.model_validate(content)
            return _scrub_intel_sources(intel, findings)
        except Exception:
            logger.warning("competitor-scan invalid research schema")
    return _heuristic_intel(worksheet, findings)


def competitor_scan(worksheet: IdeaWorksheet) -> CompetitorScanResponse:
    """Research competitor signals; returns structured intel draft, does not persist."""
    tavily_key = os.getenv("TAVILY_API_KEY")
    if not tavily_key:
        return CompetitorScanResponse(
            query=None,
            findings=[],
            intel=[],
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
            intel=[],
            suggested_evidence=(
                "Web search is disabled (ENABLE_WEB_SEARCH=false). Add competitor notes manually."
            ),
            available=False,
        )

    client = TavilyHttpClient(tavily_key)
    research_input = _research_input(worksheet)
    try:
        result = run_tavily_research(
            client,
            research_input,
            model="mini",
            output_schema=_research_output_schema(),
            exclude_domains=_EXCLUDE_DOMAINS,
        )
    except Exception as exc:
        logger.warning("competitor-scan tavily research failed: %s", exc)
        return CompetitorScanResponse(
            query=research_input,
            findings=[],
            intel=[],
            suggested_evidence="Web research failed. Add competitor notes manually.",
            available=False,
        )

    findings = _sources_to_findings(result.sources)
    intel = _parse_research_intel(result.content, worksheet, findings)
    return CompetitorScanResponse(
        query=research_input,
        findings=findings,
        intel=intel.rows,
        suggested_evidence=_format_intel_evidence(worksheet, intel),
        available=True,
    )
