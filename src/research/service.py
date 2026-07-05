"""Controlled Tavily web research for factual startup context."""

from dataclasses import dataclass
import json
import re
import time
from urllib import request
from urllib.error import HTTPError, URLError

from jinja2 import Environment, FileSystemLoader
from pydantic import BaseModel, Field

from config import PROMPTS_DIR
from idea_context import wrap_user_idea

template_env = Environment(loader=FileSystemLoader(PROMPTS_DIR))


@dataclass(frozen=True)
class ResearchFinding:
    title: str
    url: str
    content: str


@dataclass(frozen=True)
class ResearchContext:
    query: str
    findings: list[ResearchFinding]


@dataclass(frozen=True)
class TavilyResearchResult:
    content: dict | str
    sources: list[dict]


class WebSearchDecision(BaseModel):
    use_search: bool = Field(description="Whether web search is required for factual validation.")
    rationale: str = Field(
        description="Short reason for decision; mention factual risk if searching."
    )
    query: str | None = Field(
        default=None,
        description="A single high-signal Tavily query when use_search is true.",
    )


class TavilyHttpClient:
    """Tiny Tavily client via HTTP; avoids SDK lock-in."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    def search(
        self,
        query: str,
        max_results: int,
        *,
        exclude_domains: list[str] | None = None,
    ) -> list[dict]:
        payload: dict = {
            "api_key": self.api_key,
            "query": query,
            "max_results": max_results,
            "search_depth": "basic",
            "include_raw_content": False,
        }
        if exclude_domains:
            payload["exclude_domains"] = exclude_domains
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url="https://api.tavily.com/search",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=15) as resp:
                body = resp.read().decode("utf-8")
        except HTTPError as exc:
            if exc.code == 401:
                # ponytail: invalid/expired key — skip research instead of failing the roast run.
                return []
            raise RuntimeError(f"Tavily search failed: {exc}") from exc
        except URLError as exc:
            raise RuntimeError(f"Tavily search failed: {exc}") from exc

        parsed = json.loads(body)
        return parsed.get("results", [])

    def _bearer_json(
        self,
        url: str,
        *,
        method: str = "GET",
        payload: dict | None = None,
        timeout: float = 30,
    ) -> tuple[int, dict]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload).encode("utf-8")
        req = request.Request(url=url, data=data, headers=headers, method=method)
        try:
            with request.urlopen(req, timeout=timeout) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except HTTPError as exc:
            if exc.code == 401:
                raise RuntimeError("Tavily unauthorized") from exc
            body = exc.read().decode("utf-8") if exc.fp else ""
            detail = body
            try:
                parsed = json.loads(body)
                detail = parsed.get("detail", {}).get("error", body)
            except json.JSONDecodeError:
                pass
            raise RuntimeError(f"Tavily research failed: {detail or exc}") from exc
        except URLError as exc:
            raise RuntimeError(f"Tavily research failed: {exc}") from exc

    def start_research(
        self,
        input_text: str,
        *,
        model: str = "mini",
        output_schema: dict | None = None,
        exclude_domains: list[str] | None = None,
    ) -> str:
        payload: dict = {"input": input_text, "model": model}
        if output_schema:
            payload["output_schema"] = output_schema
        if exclude_domains:
            payload["exclude_domains"] = exclude_domains
        _status, body = self._bearer_json(
            "https://api.tavily.com/research",
            method="POST",
            payload=payload,
            timeout=30,
        )
        request_id = body.get("request_id")
        if not request_id:
            raise RuntimeError("Tavily research returned no request_id")
        return str(request_id)

    def get_research(self, request_id: str) -> tuple[int, dict]:
        return self._bearer_json(
            f"https://api.tavily.com/research/{request_id}",
            timeout=30,
        )


def run_tavily_research(
    client: TavilyHttpClient,
    input_text: str,
    *,
    model: str = "mini",
    output_schema: dict | None = None,
    exclude_domains: list[str] | None = None,
    poll_interval: float = 2.0,
    timeout: float = 90.0,
) -> TavilyResearchResult:
    """Start a Tavily Research task and poll until completed or failed."""
    request_id = client.start_research(
        input_text,
        model=model,
        output_schema=output_schema,
        exclude_domains=exclude_domains,
    )
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status_code, body = client.get_research(request_id)
        task_status = body.get("status")
        if status_code == 202 or task_status in {"pending", "in_progress"}:
            time.sleep(poll_interval)
            continue
        if task_status == "completed":
            return TavilyResearchResult(
                content=body.get("content", {}),
                sources=list(body.get("sources") or []),
            )
        if task_status == "failed":
            raise RuntimeError("Tavily research task failed")
        time.sleep(poll_interval)
    raise TimeoutError(f"Tavily research timed out after {timeout:.0f}s")


def decide_web_search_usage(policy_model, startup_idea: str) -> WebSearchDecision:
    """Prompt-based policy gate for sparing web search usage."""
    wrapped_idea = wrap_user_idea(startup_idea)
    decision_prompt = template_env.get_template("web_search_policy_prompt.jinja2").render(
        startup_idea=wrapped_idea,
    )
    try:
        structured_model = policy_model.with_structured_output(WebSearchDecision)
        decision = structured_model.invoke(decision_prompt)
    except Exception:
        fallback_prompt = template_env.get_template(
            "web_search_policy_fallback_prompt.jinja2"
        ).render(policy_prompt=decision_prompt)
        response = policy_model.invoke(fallback_prompt)
        content = getattr(response, "content", response)
        if not isinstance(content, str):
            content = str(content)
        data = _parse_json_object(content)
        if data is None:
            return WebSearchDecision(
                use_search=False,
                rationale="Policy evaluation unavailable; skipping web search.",
                query=None,
            )
        try:
            decision = WebSearchDecision.model_validate(data)
        except Exception:
            return WebSearchDecision(
                use_search=False,
                rationale="Policy output invalid; skipping web search.",
                query=None,
            )

    if decision.use_search and not (decision.query or "").strip():
        fallback_query = template_env.get_template("research_query_prompt.jinja2").render(
            startup_idea=wrapped_idea,
        )
        return WebSearchDecision(
            use_search=True,
            rationale=decision.rationale,
            query=fallback_query.strip(),
        )
    return decision


def _parse_json_object(content: str) -> dict | None:
    raw = content.strip()
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    return data


def _build_search_query(startup_idea: str) -> str:
    return (
        template_env.get_template("research_query_prompt.jinja2")
        .render(
            startup_idea=wrap_user_idea(startup_idea),
        )
        .strip()
    )


def _normalize_findings(raw_results: list[dict]) -> list[ResearchFinding]:
    findings: list[ResearchFinding] = []
    for row in raw_results:
        title = str(row.get("title") or "Untitled source").strip()
        url = str(row.get("url") or "").strip()
        content = str(row.get("content") or "").strip()
        if not url:
            continue
        findings.append(
            ResearchFinding(
                title=title,
                url=url,
                content=content,
            )
        )
    return findings


def build_research_context(
    startup_idea: str,
    tavily_client,
    max_results: int,
    enabled: bool,
    policy_model=None,
    decision: WebSearchDecision | None = None,
    force: bool = False,
    query_override: str | None = None,
    exclude_domains: list[str] | None = None,
) -> ResearchContext | None:
    """Run one bounded search pass and return normalized findings."""
    if not enabled:
        return None
    if query_override is not None:
        query = query_override.strip()
    elif force:
        query = _build_search_query(startup_idea)
    elif decision is not None:
        if not decision.use_search:
            return None
        query = (decision.query or "").strip() or _build_search_query(startup_idea)
    else:
        if policy_model is None:
            return None
        decision = decide_web_search_usage(policy_model, startup_idea)
        if not decision.use_search:
            return None
        query = (decision.query or "").strip() or _build_search_query(startup_idea)

    raw_results = tavily_client.search(
        query=query,
        max_results=max_results,
        exclude_domains=exclude_domains,
    )
    findings = _normalize_findings(raw_results)
    if not findings:
        return None
    return ResearchContext(query=query, findings=findings[:max_results])


def research_context_payload(context: ResearchContext) -> dict:
    """Frontend-safe research payload for SSE / REST."""
    return {
        "query": context.query,
        "findings": [
            {
                "title": finding.title,
                "url": finding.url,
                "snippet": finding.content[:260].strip(),
            }
            for finding in context.findings
        ],
    }


def format_research_context(context: ResearchContext) -> str:
    """Render compact cited research block for prompts."""
    prepared_findings = [
        {
            "title": finding.title,
            "url": finding.url,
            "snippet": finding.content[:260].strip(),
        }
        for finding in context.findings
    ]
    return (
        template_env.get_template("research_context_prompt.jinja2")
        .render(
            query=context.query,
            findings=prepared_findings,
        )
        .strip()
    )


def make_deepagent_search_tool(tavily_client, max_results: int):
    """Return a callable tool for DeepAgents orchestrator."""

    def tavily_search(query: str) -> str:
        """Search the public web for current factual signals.

        Use this only when a claim depends on current external facts
        (competition, pricing, regulation, trend, adoption, or market sizing).
        """

        results = tavily_client.search(query=query, max_results=max_results)
        findings = _normalize_findings(results)[:max_results]
        if not findings:
            return "No web results found."
        context = ResearchContext(query=query, findings=findings)
        return format_research_context(context)

    return tavily_search
