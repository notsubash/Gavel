"""LangSmith observability — opt-in tracing for LangChain and LangGraph runs."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
import hashlib
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_CONFIGURED = False
_DEFAULT_PROJECT = "gavel"


@dataclass(frozen=True)
class ObservabilitySettings:
    enabled: bool
    api_key: str | None
    project: str
    endpoint: str | None


def _read_bool(raw: str | None, default: bool = False) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env(name: str, legacy_name: str | None = None) -> str | None:
    value = os.getenv(name)
    if value:
        return value
    if legacy_name:
        return os.getenv(legacy_name)
    return None


def load_observability_settings() -> ObservabilitySettings:
    api_key = _env("LANGSMITH_API_KEY", "LANGCHAIN_API_KEY")
    tracing_flag = _env("LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2")
    enabled = _read_bool(tracing_flag, default=False)
    if api_key and tracing_flag is None:
        enabled = True
    project = _env("LANGSMITH_PROJECT", "LANGCHAIN_PROJECT") or _DEFAULT_PROJECT
    endpoint = _env("LANGSMITH_ENDPOINT", "LANGCHAIN_ENDPOINT")
    return ObservabilitySettings(
        enabled=enabled,
        api_key=api_key,
        project=project,
        endpoint=endpoint,
    )


def configure_observability(settings: ObservabilitySettings | None = None) -> bool:
    """Configure LangSmith tracing environment variables.

    Safe to call multiple times. Returns True when tracing is active.
    """
    global _CONFIGURED

    if _read_bool(os.getenv("ROAST_DISABLE_TRACING"), default=False):
        _CONFIGURED = True
        return False

    resolved = settings or load_observability_settings()
    if not resolved.enabled or not resolved.api_key:
        if resolved.enabled and not resolved.api_key:
            logger.warning(
                "LANGSMITH_TRACING is enabled but LANGSMITH_API_KEY is missing; tracing disabled"
            )
        _CONFIGURED = True
        return False

    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_API_KEY"] = resolved.api_key
    os.environ["LANGSMITH_PROJECT"] = resolved.project
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = resolved.api_key
    os.environ["LANGCHAIN_PROJECT"] = resolved.project
    if resolved.endpoint:
        os.environ["LANGSMITH_ENDPOINT"] = resolved.endpoint
        os.environ["LANGCHAIN_ENDPOINT"] = resolved.endpoint

    _CONFIGURED = True
    logger.info("LangSmith tracing enabled for project=%s", resolved.project)
    return True


def is_tracing_enabled() -> bool:
    if _read_bool(os.getenv("ROAST_DISABLE_TRACING"), default=False):
        return False
    if not _CONFIGURED:
        configure_observability()
    tracing_flag = _env("LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2")
    api_key = _env("LANGSMITH_API_KEY", "LANGCHAIN_API_KEY")
    return _read_bool(tracing_flag, default=False) and bool(api_key)


def idea_fingerprint(text: str, *, max_chars: int = 80) -> str:
    """Privacy-safe identifier for tracing metadata."""
    normalized = " ".join(text.split())
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]
    if not normalized:
        return digest
    preview = normalized[:max_chars]
    return f"{digest}:{preview}"


def build_run_config(
    run_name: str,
    *,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """RunnableConfig-compatible dict for LangGraph and LangChain invoke/stream."""
    if not is_tracing_enabled():
        return {}

    config: dict[str, Any] = {"run_name": run_name}
    if tags:
        config["tags"] = tags
    if metadata:
        config["metadata"] = metadata
    return config


def optional_config_kwargs(run_config: dict | None) -> dict[str, Any]:
    """Pass LangChain config only when tracing is active."""
    if run_config:
        return {"config": run_config}
    return {}


def _noop_traceable(
    *args: Any,
    **kwargs: Any,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        return func

    if args and callable(args[0]):
        return args[0]
    return decorator


try:
    from langsmith import traceable as _langsmith_traceable
except ImportError:
    traceable = _noop_traceable
else:
    traceable = _langsmith_traceable
