"""Tests for worksheet versioning rules."""

from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from api.workspace_store import WorkspaceStore
from validation.schemas import IdeaWorksheet
from validation.versioning import (
    build_change_summary,
    compute_worksheet_diff,
    should_create_version,
    validate_minor_edit,
)

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


class VersioningRulesTest(unittest.TestCase):
    def test_core_field_change_requires_version_bump(self):
        updated = SAMPLE.model_copy(
            update={"audience": "Bootstrapped B2B founders with 10+ customer interviews."}
        )
        diff = compute_worksheet_diff(SAMPLE, updated)
        self.assertTrue(any(item["is_core"] for item in diff))
        self.assertTrue(should_create_version(diff, minor_edit=False))
        self.assertFalse(should_create_version(diff, minor_edit=True))

    def test_minor_field_change_patches_in_place(self):
        updated = SAMPLE.model_copy(update={"working_name": "Validation Workbench"})
        diff = compute_worksheet_diff(SAMPLE, updated)
        self.assertFalse(any(item["is_core"] for item in diff))
        self.assertFalse(should_create_version(diff, minor_edit=False))

    def test_change_summary_lists_labels(self):
        updated = SAMPLE.model_copy(
            update={
                "working_name": "Validation Workbench",
                "secret_sauce": "Judges plus evidence ledger with weekly nudges.",
            }
        )
        diff = compute_worksheet_diff(SAMPLE, updated)
        summary = build_change_summary(diff)
        self.assertIn("Working name", summary)
        self.assertIn("Secret sauce", summary)

    def test_minor_edit_rejects_substantive_core_rewrite(self):
        updated = SAMPLE.model_copy(
            update={"audience": "Completely different audience segment entirely."}
        )
        diff = compute_worksheet_diff(SAMPLE, updated)
        with self.assertRaises(ValueError):
            validate_minor_edit(diff)


class WorkspaceVersioningTest(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store = WorkspaceStore(db_path=Path(self._tmpdir.name) / "workspaces.db")

    def tearDown(self):
        self.store.close()
        self._tmpdir.cleanup()

    def test_save_creates_version_chain(self):
        workspace, v1, _ = self.store.create_workspace(SAMPLE)
        updated = SAMPLE.model_copy(
            update={"solution_statement": SAMPLE.solution_statement + " with version history."}
        )
        v2, created, _ = self.store.save_worksheet(workspace.id, updated)
        self.assertTrue(created)
        self.assertEqual(v2.version, 2)
        self.assertEqual(v2.parent_version_id, v1.id)

        versions = self.store.list_versions(workspace.id)
        self.assertEqual(len(versions), 2)
        self.assertEqual(versions[0].id, v2.id)

    def test_minor_edit_patches_core_typo_without_bump(self):
        workspace, v1, _ = self.store.create_workspace(SAMPLE)
        typo_fix = SAMPLE.model_copy(
            update={"audience": SAMPLE.audience.replace("founders", "founder")}
        )
        patched, created, _ = self.store.save_worksheet(workspace.id, typo_fix, minor_edit=True)
        self.assertFalse(created)
        self.assertEqual(patched.id, v1.id)
        self.assertEqual(patched.version, 1)

    def test_in_place_edit_preserves_change_summary(self):
        workspace, v1, _ = self.store.create_workspace(SAMPLE)
        updated = SAMPLE.model_copy(update={"working_name": "Validation Workbench"})
        self.store.save_worksheet(workspace.id, updated)
        v2 = self.store.get_current_version(workspace.id)
        assert v2 is not None
        original_summary = v2.change_summary

        patched, created, _ = self.store.save_worksheet(
            workspace.id,
            v2.worksheet.model_copy(update={"existing_evidence": "Four founders asked."}),
        )
        self.assertFalse(created)
        self.assertEqual(patched.change_summary, original_summary)

    def test_evidence_stamps_worksheet_version(self):
        workspace, version, _ = self.store.create_workspace(SAMPLE)
        from validation.schemas import CreateEvidenceRequest

        evidence = self.store.create_evidence(
            workspace.id,
            CreateEvidenceRequest(type="founder_note", content="Interview notes from Sam."),
        )
        self.assertEqual(evidence.worksheet_version_id, version.id)

    def test_experiment_decision_updates_assumption(self):
        workspace, _, assumption = self.store.create_workspace(SAMPLE)
        from validation.schemas import CreateExperimentRequest, UpdateExperimentRequest

        experiment = self.store.create_experiment(
            workspace.id,
            CreateExperimentRequest(
                title="Weekly return test",
                hypothesis="Founders return weekly to log evidence.",
                assumption_id=assumption.id,
            ),
        )
        self.store.update_experiment(
            workspace.id,
            experiment.id,
            UpdateExperimentRequest(
                status="completed",
                result="3 of 5 returned within a week.",
                decision="continue",
            ),
        )
        refreshed = self.store.get_assumption(workspace.id, assumption.id)
        assert refreshed is not None
        self.assertEqual(refreshed.status, "supported")


if __name__ == "__main__":
    unittest.main()
