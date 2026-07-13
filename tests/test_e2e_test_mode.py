import asyncio
from dataclasses import replace
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from api.app import create_app
from api.deps import get_app_settings
from api.e2e_test_support import E2E_STUB_MARKER, stream_e2e_stub_pipeline
from api.run_manager import RunManager
import api.workspace_store as ws_mod
from api.workspace_store import WorkspaceStore
from config import Settings, get_settings
import tests  # noqa: F401
from tests.test_api_runs import _post_run, _workspace_id


async def _wait_for_terminal(manager: RunManager, run_id: str, *, timeout: float = 10) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        record = manager.get(run_id)
        if record is not None and record.status in ("completed", "failed", "cancelled"):
            return
        await asyncio.sleep(0.05)
    raise TimeoutError(f"Run {run_id} did not reach a terminal state within {timeout}s")


class E2eTestModeConfigTest(unittest.TestCase):
    def test_e2e_test_mode_defaults_false(self):
        get_settings.cache_clear()
        settings = get_settings()
        self.assertFalse(settings.e2e_test_mode)

    def test_stub_pipeline_yields_required_event_types(self):
        types = {type(event).__name__ for event in stream_e2e_stub_pipeline()}
        self.assertIn("PhaseStarted", types)
        self.assertIn("JudgesDispatched", types)
        self.assertIn("JudgeVerdictCompleted", types)
        self.assertIn("RoastPanelCompleted", types)
        self.assertIn("DebateRoundStarted", types)
        self.assertIn("DebateTokenDelta", types)
        self.assertIn("DebateMessagePublished", types)
        self.assertIn("DebateCompleted", types)
        self.assertIn("RunMetrics", types)
        self.assertIn("PipelineCompleted", types)


class E2eTestModeRunsApiTest(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        base = Path(self._tmpdir.name)
        self.settings = Settings(
            local_model="ollama:test",
            deepseek_model="test",
            deepseek_base_url="http://test",
            embedding_model="test",
            embedding_dimension=8,
            enable_semantic_memory=False,
            max_debate_rounds=3,
            enable_web_search=False,
            web_search_max_results=3,
            sse_heartbeat_seconds=15,
            stale_run_minutes=30,
            runs_db_path=base / "runs.db",
            workspaces_db_path=base / "workspaces.db",
            ideas_db_path=base / "ideas.db",
            rate_limit_enabled=False,
            e2e_test_mode=True,
        )
        self.ws_store = WorkspaceStore(db_path=self.settings.workspaces_db_path)
        self.manager = RunManager(db_path=self.settings.runs_db_path, recover_on_init=False)
        self._orig_store = ws_mod._store
        ws_mod._store = self.ws_store
        self._settings_patch = patch("config.get_settings", return_value=self.settings)
        self._settings_patch.start()
        self.client = TestClient(create_app(manager=self.manager))
        self.client.app.dependency_overrides[get_app_settings] = lambda: self.settings

    def tearDown(self):
        self._settings_patch.stop()
        self.client.app.dependency_overrides.clear()
        ws_mod._store = self._orig_store
        self.manager.close()
        self.ws_store.close()
        self._tmpdir.cleanup()
        get_settings.cache_clear()

    def test_stub_run_completes_without_model_calls(self):
        create_response, _ = _post_run(self.client)
        run_id = create_response.json()["run_id"]

        async def start_and_wait() -> None:
            self.manager.ensure_started(run_id, self.settings)
            await _wait_for_terminal(self.manager, run_id, timeout=10)

        asyncio.run(start_and_wait())

        events = [envelope.model_dump(mode="json") for envelope in self.manager.list_events(run_id)]
        event_types = [event["type"] for event in events]
        self.assertEqual(event_types[0], "stream_connected")
        self.assertIn("phase_started", event_types)
        self.assertIn("judge_verdict_completed", event_types)
        self.assertIn("debate_token_delta", event_types)
        self.assertIn("run_metrics", event_types)
        self.assertEqual(event_types[-1], "run_completed")

        record = self.manager.get(run_id)
        assert record is not None
        self.assertEqual(record.status, "completed")

        roast_text = events[event_types.index("judge_verdict_completed")]["payload"]["verdict"][
            "roast"
        ]
        self.assertIn(E2E_STUB_MARKER, roast_text)

    def test_stub_run_respects_max_debate_rounds(self):
        ws_id = _workspace_id(self.client)
        create_response = self.client.post(
            "/api/runs",
            json={"workspace_id": ws_id, "max_debate_rounds": 2},
        )
        run_id = create_response.json()["run_id"]

        async def start_and_wait() -> None:
            self.manager.ensure_started(run_id, self.settings)
            await _wait_for_terminal(self.manager, run_id, timeout=10)

        asyncio.run(start_and_wait())

        events = [envelope.model_dump(mode="json") for envelope in self.manager.list_events(run_id)]
        round_starts = [
            event["payload"]["round"] for event in events if event["type"] == "debate_round_started"
        ]
        self.assertEqual(round_starts, [1, 2])

    @patch("api.run_manager.stream_pipeline")
    def test_e2e_mode_skips_real_pipeline(self, stream_pipeline_mock):
        create_response, _ = _post_run(self.client)
        run_id = create_response.json()["run_id"]

        async def start_and_wait() -> None:
            self.manager.ensure_started(run_id, self.settings)
            await _wait_for_terminal(self.manager, run_id, timeout=10)

        asyncio.run(start_and_wait())
        stream_pipeline_mock.assert_not_called()

    @patch("api.run_manager.get_idea_store")
    @patch("api.run_manager.build_model_for_run", return_value=object())
    @patch("api.run_manager.stream_pipeline")
    def test_disabled_e2e_mode_invokes_real_pipeline(
        self,
        stream_pipeline_mock,
        _build_model_mock,
        store_mock,
    ):
        store_mock.return_value = MagicMock()
        disabled_settings = replace(self.settings, e2e_test_mode=False)
        self.client.app.dependency_overrides[get_app_settings] = lambda: disabled_settings
        stream_pipeline_mock.return_value = iter([])

        create_response, _ = _post_run(self.client)
        run_id = create_response.json()["run_id"]

        async def start_and_wait() -> None:
            self.manager.ensure_started(run_id, disabled_settings)
            await asyncio.sleep(0.2)

        asyncio.run(start_and_wait())
        stream_pipeline_mock.assert_called_once()

    def test_stub_appeal_completes_without_model_calls(self):
        create_response, _ = _post_run(self.client)
        run_id = create_response.json()["run_id"]

        async def start_and_wait() -> None:
            self.manager.ensure_started(run_id, self.settings)
            await _wait_for_terminal(self.manager, run_id, timeout=10)

        asyncio.run(start_and_wait())

        appeal_response = self.client.post(
            f"/api/runs/{run_id}/appeal",
            json={
                "appeal_text": (
                    "We ran five buyer interviews and three founders signed LOIs "
                    "after the pilot demo."
                ),
            },
        )
        self.assertEqual(appeal_response.status_code, 200)
        payload = appeal_response.json()
        self.assertIn(E2E_STUB_MARKER, payload["revised_synthesis"])

        events = [envelope.model_dump(mode="json") for envelope in self.manager.list_events(run_id)]
        self.assertEqual(events[-1]["type"], "appeal_completed")

    def test_stub_run_persists_handoff_items(self):
        create_response, ws_id = _post_run(self.client)
        run_id = create_response.json()["run_id"]

        async def start_and_wait() -> None:
            self.manager.ensure_started(run_id, self.settings)
            await _wait_for_terminal(self.manager, run_id, timeout=10)

        asyncio.run(start_and_wait())

        response = self.client.get(f"/api/runs/{run_id}/handoff")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["run_id"], run_id)
        self.assertEqual(payload["workspace_id"], ws_id)
        self.assertGreater(len(payload["items"]), 0)
        kinds = {item["kind"] for item in payload["items"]}
        self.assertTrue(kinds & {"assumption", "evidence_target", "experiment"})

        missing = self.client.get("/api/runs/missing-run/handoff")
        self.assertEqual(missing.status_code, 404)
