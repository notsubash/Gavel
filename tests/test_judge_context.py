from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from api.deps import load_run_workspace_context
from api.schemas import CreateRunRequest
import api.workspace_store as ws_mod
from api.workspace_store import WorkspaceStore
from validation.compose import build_judge_context
from validation.schemas import Assumption, Evidence, IdeaWorksheet

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
    competitors=["ChatGPT", "Notion templates"],
    top_risky_assumption="Solo founders will return weekly to update validation evidence.",
    disconfirming_evidence="Five founders say ChatGPT plus Notion is enough.",
)


class BuildJudgeContextTest(unittest.TestCase):
    def test_xml_sections_present(self):
        assumptions = [
            Assumption(
                id="a1",
                workspace_id="ws1",
                statement=SAMPLE.top_risky_assumption,
                type="demand",
                status="testing",
            )
        ]
        evidence = [
            Evidence(
                id="e1",
                workspace_id="ws1",
                type="interview_quote",
                strength="moderate",
                content="Founder interviews show weekly return intent.",
            )
        ]
        xml = build_judge_context(
            SAMPLE,
            assumptions,
            evidence,
            changes_since_last_run="Updated audience",
        )
        self.assertIn("<idea>", xml)
        self.assertIn("<working_name>Validation OS</working_name>", xml)
        self.assertIn('<assumption status="testing" type="demand" id="a1">', xml)
        self.assertIn('<evidence strength="moderate" type="interview_quote">', xml)
        self.assertIn("<changes_since_last_run>", xml)
        self.assertIn("Updated audience", xml)

    def test_changes_since_prior_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = WorkspaceStore(db_path=Path(tmp) / "ws.db")
            orig = ws_mod._store
            ws_mod._store = store
            try:
                ws, v1, _ = store.create_workspace(SAMPLE)
                v2_worksheet = SAMPLE.model_copy(
                    update={"audience": "A different audience segment for testing diff output."}
                )
                v2, _, _ = store.save_worksheet(ws.id, v2_worksheet)
                store.link_run("run-1", ws.id, v1.id)
                store.link_run("run-2", ws.id, v2.id)
                request = CreateRunRequest(workspace_id=ws.id, worksheet_version_id=v2.id)
                ctx = load_run_workspace_context("run-2", request)
                self.assertIn("Updated", ctx.judge_context)
                self.assertNotIn("First roast for this workspace.", ctx.judge_context)
            finally:
                ws_mod._store = orig
                store.close()


if __name__ == "__main__":
    unittest.main()
