import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from api.workspace_store import WorkspaceStore
from config import get_settings
from memory.factory import build_idea_store
import tests  # noqa: F401


class ConfigDbPathsTest(unittest.TestCase):
    def tearDown(self):
        get_settings.cache_clear()
        os.environ.pop("WORKSPACES_DB_PATH", None)
        os.environ.pop("IDEAS_DB_PATH", None)

    def test_settings_reads_workspace_and_ideas_paths_from_env(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws_path = Path(tmp) / "custom-workspaces.db"
            ideas_path = Path(tmp) / "custom-ideas.db"
            os.environ["WORKSPACES_DB_PATH"] = str(ws_path)
            os.environ["IDEAS_DB_PATH"] = str(ideas_path)
            get_settings.cache_clear()

            settings = get_settings()
            self.assertEqual(settings.workspaces_db_path, ws_path)
            self.assertEqual(settings.ideas_db_path, ideas_path)

    def test_stores_honor_settings_db_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws_path = Path(tmp) / "ws.db"
            ideas_path = Path(tmp) / "ideas.db"
            os.environ["WORKSPACES_DB_PATH"] = str(ws_path)
            os.environ["IDEAS_DB_PATH"] = str(ideas_path)
            get_settings.cache_clear()

            ws_store = WorkspaceStore(db_path=get_settings().workspaces_db_path)
            try:
                self.assertEqual(ws_store.db_path, ws_path)
            finally:
                ws_store.close()

            idea_store = build_idea_store()
            try:
                self.assertEqual(idea_store.db_path, ideas_path)
            finally:
                idea_store.close()
