from deepagents import create_deep_agent
from langchain.chat_models import init_chat_model
import os
import re
import json
from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader
from utils.tool_call_tracer import print_trace
from judges.schemas import Verdict
from pydantic import ValidationError

load_dotenv()

MODEL_NAME = os.getenv("LOCAL_MODEL")

template_env = Environment(loader=FileSystemLoader("src/prompts"))

def build_coordinator_agent():
    model = init_chat_model(MODEL_NAME)

    subagents = [
        {
            "name": "vc_judge",
            "description": "A subagent that is responsible for evaluating the startup idea from a venture capital perspective.",
            "system_prompt": template_env.get_template("vc_judge_prompt.jinja2").render()
        }
    ]

    return create_deep_agent(
        model = model,
        subagents=subagents,
        response_format=Verdict,
        system_prompt=template_env.get_template("startup_orchestrator_prompt.jinja2").render()
    )

def _strip_code_fences(text: str) -> str:
    """Remove ```json ... ``` (or plain ```) wrappers some models add."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z0-9]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _coerce_verdict_dict(data: dict) -> dict:
    """Normalize known model quirks before schema validation."""
    if "judge" in data and isinstance(data["judge"], str):
        data["judge"] = data["judge"].strip().lower()
    if "verdict" in data and isinstance(data["verdict"], str):
        data["verdict"] = data["verdict"].strip().upper()
    return data


def extract_verdict(result: dict) -> Verdict:
    """Robustly pull a validated Verdict out of a deepagents result.

    Strategy (most reliable first):
      1. structured_response, if the framework populated it.
      2. Scan messages newest-first for the first chunk of JSON that
         validates as a Verdict (this catches the vc_judge ToolMessage,
         which holds clean JSON, as well as a fenced final AIMessage).
    """
    structured = result.get("structured_response")
    if structured is not None:
        if isinstance(structured, Verdict):
            return structured
        return Verdict.model_validate(structured)

    for message in reversed(result.get("messages", [])):
        content = getattr(message, "content", None)
        if not isinstance(content, str) or not content.strip():
            continue
        candidate = _strip_code_fences(content)
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        try:
            return Verdict.model_validate(_coerce_verdict_dict(data))
        except ValidationError:
            continue

    raise ValueError("No valid verdict found in agent result messages")


def main():
    agent = build_coordinator_agent()

    startup_idea = (
        "An app that uses AI to generate startup ideas for college students."
    )

    user_prompt = (
        f"""Evaluate the following startup idea from a venture capital perspective:

        {startup_idea}

        Return the verdict in valid JSON format.
        """
    )

    result = agent.invoke(
        {"messages":[{"role":"user", "content": user_prompt}]}
    )
    print_trace(result["messages"])

    try:
        verdict = extract_verdict(result)
    except (ValueError, ValidationError) as e:
        print(f"\nError extracting verdict: {e}")
        return None

    print("\nValidated VC verdict:\n")
    print(verdict.model_dump_json(indent=2))

if __name__ == "__main__":
    main()