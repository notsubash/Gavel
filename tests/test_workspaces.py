from pathlib import Path
import sys
import tempfile
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from api.app import create_app
from api.run_manager import RunManager
from api.workspace_store import WorkspaceStore
import tests  # noqa: F401
from validation.compose import compose_generated_document
from validation.schemas import IdeaWorksheet

SAMPLE = IdeaWorksheet(
    working_name="Validation OS",
    audience="Solo technical founders building paid SaaS before they have revenue.",
    problem_statement="have trouble proving buyer demand before they build.",
    current_workaround="They use Notion docs, ChatGPT, and spreadsheets.",
    solution_statement=(
        "I am developing a local-first founder workbench to help solo founders "
        "turn startup ideas into validation experiments."
    ),
    secret_sauce="Five harsh AI judges plus a persistent evidence ledger.",
    pricing_hypothesis="$19 to $49 one-time self-hosted license.",
    existing_evidence="Three founders asked for a validation template.",
    competitors=["ChatGPT", "Notion templates", "Doing nothing"],
    top_risky_assumption="Solo founders will return weekly to update validation evidence.",
    disconfirming_evidence="Five founders say ChatGPT plus Notion is enough.",
)


class ComposeGeneratedDocumentTest(unittest.TestCase):
    def test_template_includes_core_sections(self):
        doc = compose_generated_document(SAMPLE)
        self.assertIn("Working name: Validation OS", doc)
        self.assertIn("Problem: I believe that", doc)
        self.assertIn("Top risky assumption:", doc)
        self.assertIn("- ChatGPT", doc)


class WorkspaceStoreTest(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store = WorkspaceStore(db_path=Path(self._tmpdir.name) / "workspaces.db")

    def tearDown(self):
        self.store.close()
        self._tmpdir.cleanup()

    def test_create_workspace_seeds_assumption_and_persists(self):
        workspace, version, assumption = self.store.create_workspace(SAMPLE)
        self.assertEqual(workspace.lifecycle, "draft")
        self.assertEqual(version.version, 1)
        self.assertEqual(assumption.statement, SAMPLE.top_risky_assumption)

        reloaded = self.store.get_workspace(workspace.id)
        assert reloaded is not None
        self.assertEqual(reloaded.current_version_id, version.id)

        current = self.store.get_current_version(workspace.id)
        assert current is not None
        self.assertEqual(current.generated_document, compose_generated_document(SAMPLE))

        assumptions = self.store.list_assumptions(workspace.id)
        self.assertEqual(len(assumptions), 1)

        items, total = self.store.list_workspaces()
        self.assertEqual(total, 1)
        self.assertEqual(items[0].working_name, "Validation OS")

    def test_link_run(self):
        workspace, version, _ = self.store.create_workspace(SAMPLE)
        self.store.link_run("run-1", workspace.id, version.id)
        link = self.store.get_run_link("run-1")
        self.assertEqual(link, (workspace.id, version.id))

    def test_get_last_run_version_id_excludes_current_run(self):
        workspace, v1, _ = self.store.create_workspace(SAMPLE)
        self.store.link_run("run-a", workspace.id, v1.id)
        self.store.link_run("run-b", workspace.id, v1.id)
        self.assertEqual(
            self.store.get_last_run_version_id(workspace.id, exclude_run_id="run-b"),
            v1.id,
        )
        self.assertEqual(self.store.get_last_run_version_id(workspace.id), v1.id)


class WorkspaceApiTest(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        base = Path(self._tmpdir.name)
        self.ws_store = WorkspaceStore(db_path=base / "workspaces.db")
        self.manager = RunManager(db_path=base / "runs.db", recover_on_init=False)
        import api.workspace_store as ws_mod

        self._orig_store = ws_mod._store
        ws_mod._store = self.ws_store
        self.client = TestClient(create_app(manager=self.manager))

    def tearDown(self):
        import api.workspace_store as ws_mod

        ws_mod._store = self._orig_store
        self.manager.close()
        self.ws_store.close()
        self._tmpdir.cleanup()

    def test_create_and_list_workspace_via_api(self):
        resp = self.client.post(
            "/api/workspaces",
            json={"worksheet": SAMPLE.model_dump()},
        )
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertEqual(body["workspace"]["lifecycle"], "draft")
        self.assertEqual(len(body["assumptions"]), 1)
        self.assertIn("generated_document", body["current_version"])

        listed = self.client.get("/api/workspaces")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()["total"], 1)

    def test_legacy_run_creates_workspace_link(self):
        """Phase 4: legacy flat POST /api/runs is removed; runs require workspace_id."""
        ws = self.client.post("/api/workspaces", json={"worksheet": SAMPLE.model_dump()})
        self.assertEqual(ws.status_code, 201)
        ws_id = ws.json()["workspace"]["id"]
        resp = self.client.post(
            "/api/runs",
            json={"workspace_id": ws_id, "readiness_override": True},
        )
        self.assertEqual(resp.status_code, 200)
        run_id = resp.json()["run_id"]
        link = self.ws_store.get_run_link(run_id)
        self.assertEqual(link, (ws_id, ws.json()["current_version"]["id"]))

    def test_clarify_field_rejects_unknown_field(self):
        resp = self.client.post(
            "/api/workspaces/clarify-field",
            json={"field_name": "not_a_field", "current_value": "some text here"},
        )
        self.assertEqual(resp.status_code, 422)

    def test_validation_crud_and_checklist(self):
        create = self.client.post("/api/workspaces", json={"worksheet": SAMPLE.model_dump()})
        self.assertEqual(create.status_code, 201)
        ws_id = create.json()["workspace"]["id"]

        checklist = self.client.get(f"/api/workspaces/{ws_id}/checklist")
        self.assertEqual(checklist.status_code, 200)
        items = checklist.json()["items"]
        self.assertEqual(len(items), 6)
        self.assertTrue(items[0]["completed"])

        interview = self.client.post(
            f"/api/workspaces/{ws_id}/interviews",
            json={
                "person_label": "Sam",
                "notes": "Long interview about validation pain and current workarounds used daily.",
            },
        )
        self.assertEqual(interview.status_code, 201)

        checklist2 = self.client.get(f"/api/workspaces/{ws_id}/checklist")
        problem_ev = next(i for i in checklist2.json()["items"] if i["stage"] == "problem_evidence")
        self.assertTrue(problem_ev["completed"])

        readiness = self.client.get(f"/api/workspaces/{ws_id}/readiness")
        self.assertEqual(readiness.status_code, 200)
        self.assertIn(readiness.json()["level"], ("speculative", "ready"))

        overview = self.client.get(f"/api/workspaces/{ws_id}/overview")
        self.assertEqual(overview.status_code, 200)
        self.assertIn("next_action", overview.json()["checklist"])

    def test_bulk_assumptions_and_delete(self):
        create = self.client.post("/api/workspaces", json={"worksheet": SAMPLE.model_dump()})
        ws_id = create.json()["workspace"]["id"]
        bulk = self.client.post(
            f"/api/workspaces/{ws_id}/assumptions/bulk",
            json={
                "assumptions": [
                    {
                        "id": "",
                        "workspace_id": ws_id,
                        "statement": "Founders will pay for validation tooling monthly.",
                        "type": "pricing",
                        "status": "untested",
                        "confidence": 0,
                        "disconfirming_criteria": None,
                        "worksheet_version_id": None,
                        "sort_order": 0,
                    }
                ]
            },
        )
        self.assertEqual(bulk.status_code, 200)
        self.assertEqual(len(bulk.json()["assumptions"]), 1)
        assumption_id = bulk.json()["assumptions"][0]["id"]

        deleted = self.client.delete(f"/api/workspaces/{ws_id}/assumptions/{assumption_id}")
        self.assertEqual(deleted.status_code, 204)

        missing = self.client.delete(f"/api/workspaces/{ws_id}/assumptions/{assumption_id}")
        self.assertEqual(missing.status_code, 404)

    def test_invalid_assumption_reference_returns_422(self):
        create = self.client.post("/api/workspaces", json={"worksheet": SAMPLE.model_dump()})
        ws_id = create.json()["workspace"]["id"]
        resp = self.client.post(
            f"/api/workspaces/{ws_id}/evidence",
            json={
                "type": "founder_note",
                "content": "A note about customer pain.",
                "assumption_ids": ["does-not-exist"],
            },
        )
        self.assertEqual(resp.status_code, 422)

    def test_worksheet_version_api(self):
        create = self.client.post("/api/workspaces", json={"worksheet": SAMPLE.model_dump()})
        ws_id = create.json()["workspace"]["id"]
        v1_id = create.json()["current_version"]["id"]

        updated = SAMPLE.model_copy(
            update={"problem_statement": "struggle to connect experiments to worksheet revisions."}
        )
        save = self.client.post(
            f"/api/workspaces/{ws_id}/versions",
            json={"worksheet": updated.model_dump(), "minor_edit": False},
        )
        self.assertEqual(save.status_code, 200)
        body = save.json()
        self.assertTrue(body["created"])
        self.assertEqual(body["version"]["version"], 2)
        self.assertEqual(body["version"]["parent_version_id"], v1_id)

        listed = self.client.get(f"/api/workspaces/{ws_id}/versions")
        self.assertEqual(len(listed.json()), 2)

        diff = self.client.get(f"/api/workspaces/{ws_id}/versions/{body['version']['id']}/diff")
        self.assertEqual(diff.status_code, 200)
        self.assertEqual(len(diff.json()["changes"]), 1)

    def test_version_conflict_returns_409(self):
        create = self.client.post("/api/workspaces", json={"worksheet": SAMPLE.model_dump()})
        ws_id = create.json()["workspace"]["id"]
        stale_id = create.json()["current_version"]["id"]

        updated = SAMPLE.model_copy(
            update={"problem_statement": "struggle to name the problem clearly enough."}
        )
        self.client.post(
            f"/api/workspaces/{ws_id}/versions",
            json={"worksheet": updated.model_dump()},
        )

        conflict = self.client.post(
            f"/api/workspaces/{ws_id}/versions",
            json={
                "worksheet": SAMPLE.model_dump(),
                "base_version_id": stale_id,
            },
        )
        self.assertEqual(conflict.status_code, 409)

    def test_minor_edit_rejected_for_large_core_change(self):
        create = self.client.post("/api/workspaces", json={"worksheet": SAMPLE.model_dump()})
        ws_id = create.json()["workspace"]["id"]
        rewritten = SAMPLE.model_copy(
            update={"problem_statement": "An entirely different problem statement here."}
        )
        resp = self.client.post(
            f"/api/workspaces/{ws_id}/versions",
            json={"worksheet": rewritten.model_dump(), "minor_edit": True},
        )
        self.assertEqual(resp.status_code, 422)


class ValidationPromptsTest(unittest.TestCase):
    def test_prompt_templates_render(self):
        from idea_context import wrap_untrusted
        from validation.llm.prompts import render_validation_prompt

        system = render_validation_prompt("validation_draft_system.jinja2")
        self.assertIn("validation worksheet", system)
        user = render_validation_prompt(
            "validation_draft_user.jinja2",
            founder_notes=wrap_untrusted("test notes", "founder_notes"),
        )
        self.assertIn("<founder_notes>", user)


class ValidationLlmMockTest(unittest.TestCase):
    def test_draft_from_notes_mocked(self):
        from unittest.mock import MagicMock, patch

        from validation.llm.draft import _DraftResult, draft_from_notes

        mock_result = _DraftResult(worksheet=SAMPLE, ai_drafted_fields=["audience"])
        mock_model = MagicMock()
        mock_structured = MagicMock()
        mock_structured.invoke.return_value = mock_result
        mock_model.with_structured_output.return_value = mock_structured

        with patch("validation.llm.draft.build_assist_model", return_value=mock_model):
            worksheet, fields = draft_from_notes("Some founder notes about a SaaS idea.")
        self.assertEqual(worksheet.working_name, SAMPLE.working_name)
        self.assertEqual(fields, ["audience"])


if __name__ == "__main__":
    unittest.main()
