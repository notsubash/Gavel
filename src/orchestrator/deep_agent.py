"""Optional DeepAgents orchestrator — experimental, not on the production path.

Why this exists:
  DeepAgents provides subagent spawning (task()), filesystem context mgmt,
  write_todos planning, and durable LangGraph execution. These are valuable
  for open-ended agent workflows.

Why we don't use it for roast/debate today:
  1. Local Ollama models often skip or mis-route task() calls to subagents.
  2. Debate requires deterministic turn order — an LLM orchestrator cannot
     reliably guarantee all 5 judges speak in 3 rounds.
  3. Structured output (Verdict schema) is more reliable via direct
     model.with_structured_output() than parsing ToolMessage payloads.

Use stream_pipeline() / run_pipeline() for production. Use this module
when experimenting with DeepAgents capabilities or when running on models
with strong tool-calling (e.g. devstral-2, Claude).
"""

from jinja2 import Environment, FileSystemLoader

try:
    from deepagents import create_deep_agent
except ImportError:
    create_deep_agent = None

from config import JUDGE_ORDER, PROMPTS_DIR
from judges.schemas import RoastPanel
from judges.service import judge_system_prompt
from utils.roast_panel_parser import extract_roast_panel

template_env = Environment(loader=FileSystemLoader(PROMPTS_DIR))


def build_orchestrator(model):
    """Create a DeepAgents agent with five judge subagents registered."""
    if create_deep_agent is None:
        raise ImportError(
            "deepagents is required. Install with: pip install deepagents"
        )

    judge_subagents = [
        {
            "name": f"judge-{judge}",
            "description": f"Evaluates startup ideas as the {judge} persona",
            "system_prompt": judge_system_prompt(judge),
        }
        for judge in JUDGE_ORDER
    ]

    orchestrator_prompt = template_env.get_template(
        "startup_orchestrator_prompt.jinja2"
    ).render()

    return create_deep_agent(
        model=model,
        subagents=judge_subagents,
        system_prompt=orchestrator_prompt,
    )


def run_roast_via_orchestrator(model, startup_idea: str) -> RoastPanel:
    """Experimental: delegate Phase 1 to DeepAgents task() tool.

    May fail or return incomplete panels with local models. Falls back to
    extract_roast_panel() which parses ToolMessage payloads.
    """
    agent = build_orchestrator(model)
    result = agent.invoke({
        "messages": [{"role": "user", "content": startup_idea}],
    })
    return extract_roast_panel(result)
