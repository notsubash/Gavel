from functools import lru_cache
from pathlib import Path
import tomllib


@lru_cache
def get_version() -> str:
    """Return the app version from pyproject.toml (single source of truth)."""
    pyproject = Path(__file__).resolve().parents[1] / "pyproject.toml"
    with pyproject.open("rb") as handle:
        return tomllib.load(handle)["project"]["version"]


__version__ = get_version()
