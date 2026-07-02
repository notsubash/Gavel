"""Phase 7 experiment context on appeal payloads."""

from pathlib import Path
import sys
import unittest

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from api.schemas import AppealRequest, ExperimentContextRequest


class ExperimentContextSchemaTests(unittest.TestCase):
    def test_appeal_accepts_experiment_context(self) -> None:
        body = AppealRequest(
            appeal_text="We ran fifteen interviews and none named keycap labels unprompted.",
            experiment_context=ExperimentContextRequest(
                experiment_id="exp-7cbd5814",
                changed_assumption="Power users rely on muscle memory, not key labels.",
                artifact_links=["https://example.com/notes"],
            ),
        )
        self.assertEqual(body.experiment_context.experiment_id, "exp-7cbd5814")
        self.assertEqual(len(body.experiment_context.artifact_links or []), 1)

    def test_sanitize_drops_non_http_links(self) -> None:
        body = AppealRequest(
            appeal_text="We completed the experiment and gathered notes.",
            experiment_context=ExperimentContextRequest(
                artifact_links=["javascript:alert(1)", "https://safe.example/notes"],
            ),
        )
        links = body.experiment_context.artifact_links if body.experiment_context else []
        self.assertEqual(links, ["https://safe.example/notes"])

    def test_assumption_max_length(self) -> None:
        with self.assertRaises(ValidationError):
            AppealRequest(
                appeal_text="Valid evidence text here.",
                experiment_context=ExperimentContextRequest(
                    changed_assumption="x" * 501,
                ),
            )


if __name__ == "__main__":
    unittest.main()
