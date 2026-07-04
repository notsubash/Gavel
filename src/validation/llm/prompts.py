"""Jinja2 prompt loading for validation LLM assists."""

from __future__ import annotations

from jinja2 import Environment, FileSystemLoader

from config import PROMPTS_DIR
from idea_context import UNTRUSTED_DATA_INSTRUCTION, wrap_untrusted

template_env = Environment(loader=FileSystemLoader(PROMPTS_DIR))


def render_validation_prompt(template_name: str, **context: object) -> str:
    return template_env.get_template(template_name).render(
        injection_defense=UNTRUSTED_DATA_INSTRUCTION,
        **context,
    )


def wrap_worksheet_context(worksheet_json: str) -> str:
    return wrap_untrusted(worksheet_json, "worksheet")
