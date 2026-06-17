"""Single-judge evaluation — no UI, no orchestration."""

from langchain_core.messages import HumanMessage, SystemMessage
from jinja2 import Environment, FileSystemLoader

from config import PROMPTS_DIR
from judges.schemas import Verdict

template_env = Environment(loader=FileSystemLoader(PROMPTS_DIR))

JUDGE_TEMPLATES = {
    "vc": "vc_judge_prompt.jinja2",
    "engineer": "engineer_judge_prompt.jinja2",
    "pm": "pm_judge_prompt.jinja2",
    "customer": "customer_judge_prompt.jinja2",
    "competitor": "competitor_judge_prompt.jinja2",
}


def judge_system_prompt(judge: str) -> str:
    return template_env.get_template(JUDGE_TEMPLATES[judge]).render()


def invoke_judge(model, judge: str, startup_idea: str) -> Verdict:
    """Evaluate one startup idea with structured output."""
    structured_model = model.with_structured_output(Verdict)
    return structured_model.invoke([
        SystemMessage(content=judge_system_prompt(judge)),
        HumanMessage(content=f"Evaluate this startup idea:\n\n{startup_idea}"),
    ])
