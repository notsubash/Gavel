"""Shared helpers for validation LLM assists."""

from __future__ import annotations

import os

from config import Settings, get_settings
from modeling import build_chat_model


def build_assist_model(settings: Settings | None = None):
    settings = settings or get_settings()
    return build_chat_model("deepseek", settings, os.getenv("DEEPSEEK_API_KEY"))
