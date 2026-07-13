from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from api.workspace_store import WorkspaceStore
from validation.checklist import build_checklist
from validation.confidence import compute_confidence
from validation.lifecycle import compute_lifecycle
from validation.readiness import evaluate_readiness
from validation.schemas import (
    CreateEvidenceRequest,
    CreateExperimentRequest,
    CreateInterviewRequest,
    Evidence,
    IdeaWorksheet,
    UpdateExperimentRequest,
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


class ReadinessTest(unittest.TestCase):
    def test_too_vague_when_problem_equals_solution(self):
        bad = SAMPLE.model_copy(update={"problem_statement": SAMPLE.solution_statement[:4000]})
        result = evaluate_readiness(bad, [])
        self.assertEqual(result.level, "too_vague")
        self.assertFalse(result.can_run_judges)

    def test_speculative_without_human_evidence(self):
        result = evaluate_readiness(SAMPLE, [])
        self.assertEqual(result.level, "speculative")
        self.assertTrue(result.can_run_judges)

    def test_ready_with_interview_evidence(self):
        evidence = [
            Evidence(
                id="e1",
                workspace_id="w1",
                type="interview_quote",
                content="Founder spends 6 hours weekly on validation spreadsheets.",
            )
        ]
        result = evaluate_readiness(SAMPLE, evidence)
        self.assertEqual(result.level, "ready")

    def test_founder_note_stays_speculative(self):
        evidence = [
            Evidence(
                id="e1",
                workspace_id="w1",
                type="founder_note",
                content="I talked to three friends who said this sounds useful.",
            )
        ]
        result = evaluate_readiness(SAMPLE, evidence)
        self.assertEqual(result.level, "speculative")
        self.assertTrue(result.can_run_judges)

    def test_rerun_blocked_without_delta(self):
        result = evaluate_readiness(
            SAMPLE,
            [],
            has_prior_run=True,
            worksheet_changed_since_run=False,
        )
        self.assertFalse(result.can_run_judges)
        rerun = next(c for c in result.checks if c.name == "rerun_delta")
        self.assertFalse(rerun.passed)

    def test_rerun_allowed_after_worksheet_change(self):
        result = evaluate_readiness(
            SAMPLE,
            [],
            has_prior_run=True,
            worksheet_changed_since_run=True,
        )
        self.assertTrue(result.can_run_judges)
        self.assertEqual(result.level, "speculative")


class ChecklistTest(unittest.TestCase):
    def test_problem_clarity_auto_complete_on_valid_worksheet(self):
        checklist = build_checklist(
            worksheet=SAMPLE,
            assumptions=[],
            evidence=[],
            experiments=[],
            interviews=[],
        )
        clarity = next(i for i in checklist.items if i.stage == "problem_clarity")
        self.assertTrue(clarity.completed)

    def test_interview_completes_problem_evidence(self):
        from validation.schemas import InterviewNote

        checklist = build_checklist(
            worksheet=SAMPLE,
            assumptions=[],
            evidence=[],
            experiments=[],
            interviews=[
                InterviewNote(
                    id="i1",
                    workspace_id="w1",
                    person_label="Alex",
                    notes="Talked about validation pain for 30 minutes.",
                )
            ],
        )
        problem_ev = next(i for i in checklist.items if i.stage == "problem_evidence")
        self.assertTrue(problem_ev.completed)
        self.assertIn("experiment", checklist.next_action.lower())


class ConfidenceTest(unittest.TestCase):
    def test_unknown_demand_without_evidence(self):
        result = compute_confidence(worksheet=SAMPLE, assumptions=[], evidence=[])
        demand = next(c for c in result.chips if c.dimension == "demand")
        self.assertEqual(demand.label, "unknown")

    def test_mapped_competition_with_competitors(self):
        result = compute_confidence(worksheet=SAMPLE, assumptions=[], evidence=[])
        comp = next(c for c in result.chips if c.dimension == "competition")
        self.assertEqual(comp.label, "mapped")


class LifecycleTest(unittest.TestCase):
    def test_draft_for_new_workspace(self):
        self.assertEqual(
            compute_lifecycle(
                run_count=0,
                readiness_level="speculative",
                experiments=[],
                interviews=[],
                evidence=[],
            ),
            "draft",
        )

    def test_discovery_after_interview(self):
        from validation.schemas import InterviewNote

        self.assertEqual(
            compute_lifecycle(
                run_count=0,
                readiness_level="speculative",
                experiments=[],
                interviews=[
                    InterviewNote(id="i1", workspace_id="w1", person_label="A", notes="notes")
                ],
                evidence=[],
            ),
            "discovery",
        )

    def test_iterating_after_roast_with_worksheet_change(self):
        self.assertEqual(
            compute_lifecycle(
                run_count=1,
                readiness_level="speculative",
                experiments=[],
                interviews=[],
                evidence=[],
                worksheet_changed_since_run=True,
            ),
            "iterating",
        )

    def test_judged_after_roast_without_worksheet_change(self):
        self.assertEqual(
            compute_lifecycle(
                run_count=1,
                readiness_level="ready",
                experiments=[],
                interviews=[],
                evidence=[],
                worksheet_changed_since_run=False,
            ),
            "judged",
        )


class ValidationCrudTest(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store = WorkspaceStore(db_path=Path(self._tmpdir.name) / "workspaces.db")
        self.workspace, _, _ = self.store.create_workspace(SAMPLE)

    def tearDown(self):
        self.store.close()
        self._tmpdir.cleanup()

    def test_evidence_and_experiment_crud(self):
        exp = self.store.create_experiment(
            self.workspace.id,
            CreateExperimentRequest(
                title="Interview sprint",
                hypothesis="Founders feel validation pain weekly",
                pass_fail_threshold="5 interviews mention spreadsheet pain",
            ),
        )
        self.assertEqual(exp.status, "planned")

        self.store.create_evidence(
            self.workspace.id,
            CreateEvidenceRequest(
                type="interview_quote",
                content="I waste hours every week updating my validation doc.",
                assumption_ids=[],
            ),
        )
        self.assertEqual(len(self.store.list_evidence(self.workspace.id)), 1)

        updated = self.store.update_experiment(
            self.workspace.id,
            exp.id,
            UpdateExperimentRequest(status="active"),
        )
        assert updated is not None
        self.assertEqual(updated.status, "active")

        reloaded = self.store.get_workspace(self.workspace.id)
        assert reloaded is not None
        self.assertEqual(reloaded.lifecycle, "testing")

    def test_worksheet_changed_since_last_run(self):
        workspace, version, _assumption = self.store.create_workspace(SAMPLE)
        self.store.link_run("run-1", workspace.id, version.id)
        self.assertFalse(self.store.worksheet_changed_since_last_run(workspace.id))

        updated = SAMPLE.model_copy(update={"competitors": ["ChatGPT", "Notion", "Excel"]})
        new_version, created, _ = self.store.save_worksheet(workspace.id, updated)
        self.assertTrue(created)
        self.assertNotEqual(new_version.id, version.id)
        self.assertTrue(self.store.worksheet_changed_since_last_run(workspace.id))
        # roasted snapshot stays intact
        frozen = self.store.get_version(version.id)
        assert frozen is not None
        self.assertEqual(frozen.worksheet.competitors, SAMPLE.competitors)

    def test_invalid_assumption_id_raises(self):
        workspace, _, _ = self.store.create_workspace(SAMPLE)
        with self.assertRaises(ValueError):
            self.store.create_evidence(
                workspace.id,
                CreateEvidenceRequest(
                    type="founder_note",
                    content="Some note about validation.",
                    assumption_ids=["not-real"],
                ),
            )

    def test_interview_advances_lifecycle_to_discovery(self):
        self.store.create_interview(
            self.workspace.id,
            CreateInterviewRequest(
                person_label="Jordan",
                notes="Detailed conversation about validation workflow pain points.",
            ),
        )
        reloaded = self.store.get_workspace(self.workspace.id)
        assert reloaded is not None
        self.assertEqual(reloaded.lifecycle, "discovery")


if __name__ == "__main__":
    unittest.main()
