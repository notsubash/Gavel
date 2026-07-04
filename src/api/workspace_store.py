"""SQLite-backed workspace persistence."""

from __future__ import annotations

from datetime import UTC, datetime
import json
import sqlite3
import threading
from uuid import uuid4

from config import PROJECT_ROOT
from validation.compose import compose_generated_document
from validation.lifecycle import compute_lifecycle
from validation.readiness import evaluate_readiness
from validation.schemas import (
    Assumption,
    CreateAssumptionRequest,
    CreateEvidenceRequest,
    CreateExperimentRequest,
    CreateInterviewRequest,
    Evidence,
    Experiment,
    IdeaWorksheet,
    InterviewNote,
    UpdateAssumptionRequest,
    UpdateEvidenceRequest,
    UpdateExperimentRequest,
    UpdateInterviewRequest,
    WorksheetVersion,
    Workspace,
    WorkspaceLifecycle,
    WorkspaceListItem,
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    lifecycle TEXT NOT NULL DEFAULT 'draft',
    current_version_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worksheet_versions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    version INTEGER NOT NULL,
    parent_version_id TEXT,
    worksheet_json TEXT NOT NULL,
    generated_document TEXT NOT NULL,
    change_summary TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(workspace_id, version)
);

CREATE TABLE IF NOT EXISTS assumptions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    statement TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'demand',
    status TEXT NOT NULL DEFAULT 'untested',
    confidence REAL NOT NULL DEFAULT 0.0,
    disconfirming_criteria TEXT,
    worksheet_version_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workspace_runs (
    run_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    worksheet_version_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worksheet_versions_workspace
    ON worksheet_versions (workspace_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_assumptions_workspace
    ON assumptions (workspace_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_workspace_runs_workspace
    ON workspace_runs (workspace_id);

CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    title TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    assumption_id TEXT,
    method TEXT,
    target TEXT,
    pass_fail_threshold TEXT,
    start_date TEXT,
    due_date TEXT,
    result TEXT,
    decision TEXT NOT NULL DEFAULT 'pending',
    status TEXT NOT NULL DEFAULT 'planned'
);

CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,
    strength TEXT NOT NULL DEFAULT 'weak',
    source TEXT,
    content TEXT NOT NULL,
    occurred_at TEXT,
    assumption_ids_json TEXT NOT NULL DEFAULT '[]',
    experiment_id TEXT,
    worksheet_version_id TEXT
);

CREATE TABLE IF NOT EXISTS interview_notes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    person_label TEXT NOT NULL,
    segment TEXT,
    occurred_at TEXT,
    context TEXT,
    notes TEXT NOT NULL,
    quotes_json TEXT NOT NULL DEFAULT '[]',
    workaround TEXT,
    pain_cost TEXT,
    objections TEXT,
    assumption_ids_json TEXT NOT NULL DEFAULT '[]',
    ai_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_experiments_workspace
    ON experiments (workspace_id);
CREATE INDEX IF NOT EXISTS idx_evidence_workspace
    ON evidence (workspace_id);
CREATE INDEX IF NOT EXISTS idx_interview_notes_workspace
    ON interview_notes (workspace_id);
"""


class WorkspaceStore:
    def __init__(self, db_path=None) -> None:
        self.db_path = db_path or PROJECT_ROOT / "data" / "workspaces.db"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def create_workspace(
        self, worksheet: IdeaWorksheet
    ) -> tuple[Workspace, WorksheetVersion, Assumption]:
        now = datetime.now(UTC)
        workspace_id = str(uuid4())
        version_id = str(uuid4())
        assumption_id = str(uuid4())
        generated = compose_generated_document(worksheet)

        with self._lock:
            self._conn.execute(
                """
                INSERT INTO workspaces (id, lifecycle, current_version_id, created_at, updated_at)
                VALUES (?, 'draft', ?, ?, ?)
                """,
                (workspace_id, version_id, now.isoformat(), now.isoformat()),
            )
            self._conn.execute(
                """
                INSERT INTO worksheet_versions
                    (id, workspace_id, version, parent_version_id, worksheet_json,
                     generated_document, change_summary, created_at)
                VALUES (?, ?, 1, NULL, ?, ?, NULL, ?)
                """,
                (
                    version_id,
                    workspace_id,
                    worksheet.model_dump_json(),
                    generated,
                    now.isoformat(),
                ),
            )
            self._conn.execute(
                """
                INSERT INTO assumptions
                    (id, workspace_id, statement, type, status, confidence,
                     disconfirming_criteria, worksheet_version_id, sort_order)
                VALUES (?, ?, ?, 'demand', 'untested', 0.0, ?, ?, 0)
                """,
                (
                    assumption_id,
                    workspace_id,
                    worksheet.top_risky_assumption,
                    worksheet.disconfirming_evidence,
                    version_id,
                ),
            )
            self._conn.commit()

        workspace = Workspace(
            id=workspace_id,
            lifecycle="draft",
            current_version_id=version_id,
            created_at=now,
            updated_at=now,
        )
        version = WorksheetVersion(
            id=version_id,
            workspace_id=workspace_id,
            version=1,
            worksheet=worksheet,
            generated_document=generated,
            created_at=now,
        )
        assumption = Assumption(
            id=assumption_id,
            workspace_id=workspace_id,
            statement=worksheet.top_risky_assumption,
            type="demand",
            disconfirming_criteria=worksheet.disconfirming_evidence,
            worksheet_version_id=version_id,
        )
        return workspace, version, assumption

    def list_workspaces(
        self, *, limit: int = 20, offset: int = 0
    ) -> tuple[list[WorkspaceListItem], int]:
        with self._lock:
            total = int(self._conn.execute("SELECT COUNT(*) FROM workspaces").fetchone()[0])
            rows = self._conn.execute(
                """
                SELECT w.id, w.lifecycle, w.created_at, w.updated_at, w.current_version_id,
                       (SELECT COUNT(*) FROM assumptions a WHERE a.workspace_id = w.id) AS assumption_count
                FROM workspaces w
                ORDER BY w.updated_at DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            ).fetchall()

        items: list[WorkspaceListItem] = []
        for row in rows:
            ws_id, lifecycle, created_at, updated_at, version_id, assumption_count = row
            working_name = "Untitled"
            if version_id:
                with self._lock:
                    vrow = self._conn.execute(
                        "SELECT worksheet_json FROM worksheet_versions WHERE id = ?",
                        (version_id,),
                    ).fetchone()
                if vrow:
                    worksheet = IdeaWorksheet.model_validate_json(vrow[0])
                    working_name = worksheet.working_name
            items.append(
                WorkspaceListItem(
                    id=ws_id,
                    working_name=working_name,
                    lifecycle=lifecycle,
                    created_at=datetime.fromisoformat(created_at),
                    updated_at=datetime.fromisoformat(updated_at),
                    assumption_count=assumption_count,
                )
            )
        return items, total

    def get_workspace(self, workspace_id: str) -> Workspace | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT id, lifecycle, current_version_id, created_at, updated_at FROM workspaces WHERE id = ?",
                (workspace_id,),
            ).fetchone()
        if row is None:
            return None
        return Workspace(
            id=row[0],
            lifecycle=row[1],
            current_version_id=row[2],
            created_at=datetime.fromisoformat(row[3]),
            updated_at=datetime.fromisoformat(row[4]),
        )

    def get_version(self, version_id: str) -> WorksheetVersion | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, workspace_id, version, worksheet_json, generated_document,
                       change_summary, parent_version_id, created_at
                FROM worksheet_versions WHERE id = ?
                """,
                (version_id,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_version(row)

    def get_current_version(self, workspace_id: str) -> WorksheetVersion | None:
        workspace = self.get_workspace(workspace_id)
        if workspace is None or workspace.current_version_id is None:
            return None
        return self.get_version(workspace.current_version_id)

    def list_assumptions(self, workspace_id: str) -> list[Assumption]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, workspace_id, statement, type, status, confidence,
                       disconfirming_criteria, worksheet_version_id, sort_order
                FROM assumptions WHERE workspace_id = ?
                ORDER BY sort_order
                """,
                (workspace_id,),
            ).fetchall()
        return [self._row_to_assumption(r) for r in rows]

    def update_lifecycle(
        self, workspace_id: str, lifecycle: WorkspaceLifecycle
    ) -> Workspace | None:
        now = datetime.now(UTC)
        with self._lock:
            cur = self._conn.execute(
                "UPDATE workspaces SET lifecycle = ?, updated_at = ? WHERE id = ?",
                (lifecycle, now.isoformat(), workspace_id),
            )
            self._conn.commit()
            if cur.rowcount == 0:
                return None
        return self.get_workspace(workspace_id)

    def touch_workspace(self, workspace_id: str) -> None:
        now = datetime.now(UTC)
        with self._lock:
            self._conn.execute(
                "UPDATE workspaces SET updated_at = ? WHERE id = ?",
                (now.isoformat(), workspace_id),
            )
            self._conn.commit()

    def insert_assumptions(
        self, workspace_id: str, assumptions: list[Assumption]
    ) -> list[Assumption]:
        with self._lock:
            existing = self._conn.execute(
                "SELECT COALESCE(MAX(sort_order), -1) FROM assumptions WHERE workspace_id = ?",
                (workspace_id,),
            ).fetchone()[0]
            next_order = int(existing) + 1
            saved: list[Assumption] = []
            for item in assumptions:
                assumption_id = item.id or str(uuid4())
                self._conn.execute(
                    """
                    INSERT INTO assumptions
                        (id, workspace_id, statement, type, status, confidence,
                         disconfirming_criteria, worksheet_version_id, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        assumption_id,
                        workspace_id,
                        item.statement,
                        item.type,
                        item.status,
                        item.confidence,
                        item.disconfirming_criteria,
                        item.worksheet_version_id,
                        next_order,
                    ),
                )
                saved.append(
                    item.model_copy(update={"id": assumption_id, "sort_order": next_order})
                )
                next_order += 1
            self._conn.commit()
        self.touch_workspace(workspace_id)
        self.sync_lifecycle(workspace_id)
        return saved

    def link_run(self, run_id: str, workspace_id: str, worksheet_version_id: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO workspace_runs (run_id, workspace_id, worksheet_version_id)
                VALUES (?, ?, ?)
                """,
                (run_id, workspace_id, worksheet_version_id),
            )
            self._conn.commit()

    def get_run_link(self, run_id: str) -> tuple[str, str] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT workspace_id, worksheet_version_id FROM workspace_runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
        if row is None:
            return None
        return row[0], row[1]

    def count_runs(self, workspace_id: str) -> int:
        with self._lock:
            row = self._conn.execute(
                "SELECT COUNT(*) FROM workspace_runs WHERE workspace_id = ?",
                (workspace_id,),
            ).fetchone()
        return int(row[0]) if row else 0

    def get_last_run_version_id(self, workspace_id: str) -> str | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT worksheet_version_id FROM workspace_runs
                WHERE workspace_id = ?
                ORDER BY rowid DESC LIMIT 1
                """,
                (workspace_id,),
            ).fetchone()
        return row[0] if row else None

    def worksheet_changed_since_last_run(self, workspace_id: str) -> bool:
        workspace = self.get_workspace(workspace_id)
        if workspace is None or workspace.current_version_id is None:
            return False
        last_version_id = self.get_last_run_version_id(workspace_id)
        if last_version_id is None:
            return False
        return last_version_id != workspace.current_version_id

    def _require_assumption_id(self, workspace_id: str, assumption_id: str | None) -> str | None:
        if assumption_id is None:
            return None
        if self.get_assumption(workspace_id, assumption_id) is None:
            raise ValueError(f"unknown assumption_id: {assumption_id}")
        return assumption_id

    def _require_assumption_ids(self, workspace_id: str, assumption_ids: list[str]) -> list[str]:
        if not assumption_ids:
            return []
        valid = {a.id for a in self.list_assumptions(workspace_id)}
        unknown = [aid for aid in assumption_ids if aid not in valid]
        if unknown:
            raise ValueError(f"unknown assumption_ids: {unknown}")
        return assumption_ids

    def get_assumption(self, workspace_id: str, assumption_id: str) -> Assumption | None:
        assumptions = self.list_assumptions(workspace_id)
        return next((a for a in assumptions if a.id == assumption_id), None)

    def create_assumption(self, workspace_id: str, body: CreateAssumptionRequest) -> Assumption:
        assumption_id = str(uuid4())
        version = self.get_current_version(workspace_id)
        version_id = body.worksheet_version_id or (version.id if version else None)
        with self._lock:
            existing = self._conn.execute(
                "SELECT COALESCE(MAX(sort_order), -1) FROM assumptions WHERE workspace_id = ?",
                (workspace_id,),
            ).fetchone()[0]
            sort_order = int(existing) + 1
            self._conn.execute(
                """
                INSERT INTO assumptions
                    (id, workspace_id, statement, type, status, confidence,
                     disconfirming_criteria, worksheet_version_id, sort_order)
                VALUES (?, ?, ?, ?, 'untested', 0.0, ?, ?, ?)
                """,
                (
                    assumption_id,
                    workspace_id,
                    body.statement,
                    body.type,
                    body.disconfirming_criteria,
                    version_id,
                    sort_order,
                ),
            )
            self._conn.commit()
        self.touch_workspace(workspace_id)
        self.sync_lifecycle(workspace_id)
        return Assumption(
            id=assumption_id,
            workspace_id=workspace_id,
            statement=body.statement,
            type=body.type,
            disconfirming_criteria=body.disconfirming_criteria,
            worksheet_version_id=version_id,
            sort_order=sort_order,
        )

    def update_assumption(
        self, workspace_id: str, assumption_id: str, body: UpdateAssumptionRequest
    ) -> Assumption | None:
        current = self.get_assumption(workspace_id, assumption_id)
        if current is None:
            return None
        updated = current.model_copy(
            update={k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
        )
        with self._lock:
            self._conn.execute(
                """
                UPDATE assumptions
                SET statement = ?, type = ?, status = ?, confidence = ?,
                    disconfirming_criteria = ?, sort_order = ?
                WHERE id = ? AND workspace_id = ?
                """,
                (
                    updated.statement,
                    updated.type,
                    updated.status,
                    updated.confidence,
                    updated.disconfirming_criteria,
                    updated.sort_order,
                    assumption_id,
                    workspace_id,
                ),
            )
            self._conn.commit()
        self.touch_workspace(workspace_id)
        self.sync_lifecycle(workspace_id)
        return updated

    def delete_assumption(self, workspace_id: str, assumption_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM assumptions WHERE id = ? AND workspace_id = ?",
                (assumption_id, workspace_id),
            )
            self._conn.commit()
            deleted = cur.rowcount > 0
        if deleted:
            self.touch_workspace(workspace_id)
            self.sync_lifecycle(workspace_id)
        return deleted

    def list_experiments(self, workspace_id: str) -> list[Experiment]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, workspace_id, title, hypothesis, assumption_id, method, target,
                       pass_fail_threshold, start_date, due_date, result, decision, status
                FROM experiments WHERE workspace_id = ?
                ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END,
                         title
                """,
                (workspace_id,),
            ).fetchall()
        return [self._row_to_experiment(r) for r in rows]

    def get_experiment(self, workspace_id: str, experiment_id: str) -> Experiment | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, workspace_id, title, hypothesis, assumption_id, method, target,
                       pass_fail_threshold, start_date, due_date, result, decision, status
                FROM experiments WHERE id = ? AND workspace_id = ?
                """,
                (experiment_id, workspace_id),
            ).fetchone()
        return self._row_to_experiment(row) if row else None

    def create_experiment(self, workspace_id: str, body: CreateExperimentRequest) -> Experiment:
        assumption_id = self._require_assumption_id(workspace_id, body.assumption_id)
        experiment_id = str(uuid4())
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO experiments
                    (id, workspace_id, title, hypothesis, assumption_id, method, target,
                     pass_fail_threshold, start_date, due_date, result, decision, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?)
                """,
                (
                    experiment_id,
                    workspace_id,
                    body.title,
                    body.hypothesis,
                    assumption_id,
                    body.method,
                    body.target,
                    body.pass_fail_threshold,
                    body.start_date,
                    body.due_date,
                    body.status,
                ),
            )
            self._conn.commit()
        self.touch_workspace(workspace_id)
        self.sync_lifecycle(workspace_id)
        return Experiment(
            id=experiment_id,
            workspace_id=workspace_id,
            title=body.title,
            hypothesis=body.hypothesis,
            assumption_id=body.assumption_id,
            method=body.method,
            target=body.target,
            pass_fail_threshold=body.pass_fail_threshold,
            start_date=body.start_date,
            due_date=body.due_date,
            status=body.status,
        )

    def update_experiment(
        self, workspace_id: str, experiment_id: str, body: UpdateExperimentRequest
    ) -> Experiment | None:
        current = self.get_experiment(workspace_id, experiment_id)
        if current is None:
            return None
        patch = body.model_dump(exclude_unset=True)
        if "assumption_id" in patch:
            patch["assumption_id"] = self._require_assumption_id(
                workspace_id, patch["assumption_id"]
            )
        updated = current.model_copy(update=patch)
        with self._lock:
            self._conn.execute(
                """
                UPDATE experiments
                SET title = ?, hypothesis = ?, assumption_id = ?, method = ?, target = ?,
                    pass_fail_threshold = ?, start_date = ?, due_date = ?, result = ?,
                    decision = ?, status = ?
                WHERE id = ? AND workspace_id = ?
                """,
                (
                    updated.title,
                    updated.hypothesis,
                    updated.assumption_id,
                    updated.method,
                    updated.target,
                    updated.pass_fail_threshold,
                    updated.start_date,
                    updated.due_date,
                    updated.result,
                    updated.decision,
                    updated.status,
                    experiment_id,
                    workspace_id,
                ),
            )
            self._conn.commit()
        self.touch_workspace(workspace_id)
        self.sync_lifecycle(workspace_id)
        return updated

    def delete_experiment(self, workspace_id: str, experiment_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM experiments WHERE id = ? AND workspace_id = ?",
                (experiment_id, workspace_id),
            )
            self._conn.commit()
            deleted = cur.rowcount > 0
        if deleted:
            self.touch_workspace(workspace_id)
            self.sync_lifecycle(workspace_id)
        return deleted

    def list_evidence(self, workspace_id: str) -> list[Evidence]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, workspace_id, type, strength, source, content, occurred_at,
                       assumption_ids_json, experiment_id, worksheet_version_id
                FROM evidence WHERE workspace_id = ?
                ORDER BY occurred_at DESC, rowid DESC
                """,
                (workspace_id,),
            ).fetchall()
        return [self._row_to_evidence(r) for r in rows]

    def get_evidence(self, workspace_id: str, evidence_id: str) -> Evidence | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, workspace_id, type, strength, source, content, occurred_at,
                       assumption_ids_json, experiment_id, worksheet_version_id
                FROM evidence WHERE id = ? AND workspace_id = ?
                """,
                (evidence_id, workspace_id),
            ).fetchone()
        return self._row_to_evidence(row) if row else None

    def create_evidence(self, workspace_id: str, body: CreateEvidenceRequest) -> Evidence:
        assumption_ids = self._require_assumption_ids(workspace_id, body.assumption_ids)
        evidence_id = str(uuid4())
        version = self.get_current_version(workspace_id)
        version_id = body.worksheet_version_id or (version.id if version else None)
        occurred = body.occurred_at.isoformat() if body.occurred_at else None
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO evidence
                    (id, workspace_id, type, strength, source, content, occurred_at,
                     assumption_ids_json, experiment_id, worksheet_version_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    evidence_id,
                    workspace_id,
                    body.type,
                    body.strength,
                    body.source,
                    body.content,
                    occurred,
                    json.dumps(assumption_ids),
                    body.experiment_id,
                    version_id,
                ),
            )
            self._conn.commit()
        self.touch_workspace(workspace_id)
        self.sync_lifecycle(workspace_id)
        return Evidence(
            id=evidence_id,
            workspace_id=workspace_id,
            type=body.type,
            strength=body.strength,
            source=body.source,
            content=body.content,
            occurred_at=body.occurred_at,
            assumption_ids=assumption_ids,
            experiment_id=body.experiment_id,
            worksheet_version_id=version_id,
        )

    def update_evidence(
        self, workspace_id: str, evidence_id: str, body: UpdateEvidenceRequest
    ) -> Evidence | None:
        current = self.get_evidence(workspace_id, evidence_id)
        if current is None:
            return None
        patch = body.model_dump(exclude_unset=True)
        if "assumption_ids" in patch:
            patch["assumption_ids"] = self._require_assumption_ids(
                workspace_id, patch["assumption_ids"]
            )
        updated = current.model_copy(update=patch)
        occurred = updated.occurred_at.isoformat() if updated.occurred_at else None
        with self._lock:
            self._conn.execute(
                """
                UPDATE evidence
                SET type = ?, strength = ?, source = ?, content = ?, occurred_at = ?,
                    assumption_ids_json = ?, experiment_id = ?
                WHERE id = ? AND workspace_id = ?
                """,
                (
                    updated.type,
                    updated.strength,
                    updated.source,
                    updated.content,
                    occurred,
                    json.dumps(updated.assumption_ids),
                    updated.experiment_id,
                    evidence_id,
                    workspace_id,
                ),
            )
            self._conn.commit()
        self.touch_workspace(workspace_id)
        self.sync_lifecycle(workspace_id)
        return updated

    def delete_evidence(self, workspace_id: str, evidence_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM evidence WHERE id = ? AND workspace_id = ?",
                (evidence_id, workspace_id),
            )
            self._conn.commit()
            deleted = cur.rowcount > 0
        if deleted:
            self.touch_workspace(workspace_id)
            self.sync_lifecycle(workspace_id)
        return deleted

    def list_interviews(self, workspace_id: str) -> list[InterviewNote]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, workspace_id, person_label, segment, occurred_at, context, notes,
                       quotes_json, workaround, pain_cost, objections, assumption_ids_json,
                       ai_summary
                FROM interview_notes WHERE workspace_id = ?
                ORDER BY occurred_at DESC, rowid DESC
                """,
                (workspace_id,),
            ).fetchall()
        return [self._row_to_interview(r) for r in rows]

    def get_interview(self, workspace_id: str, interview_id: str) -> InterviewNote | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, workspace_id, person_label, segment, occurred_at, context, notes,
                       quotes_json, workaround, pain_cost, objections, assumption_ids_json,
                       ai_summary
                FROM interview_notes WHERE id = ? AND workspace_id = ?
                """,
                (interview_id, workspace_id),
            ).fetchone()
        return self._row_to_interview(row) if row else None

    def create_interview(self, workspace_id: str, body: CreateInterviewRequest) -> InterviewNote:
        assumption_ids = self._require_assumption_ids(workspace_id, body.assumption_ids)
        interview_id = str(uuid4())
        occurred = body.occurred_at.isoformat() if body.occurred_at else None
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO interview_notes
                    (id, workspace_id, person_label, segment, occurred_at, context, notes,
                     quotes_json, workaround, pain_cost, objections, assumption_ids_json,
                     ai_summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    interview_id,
                    workspace_id,
                    body.person_label,
                    body.segment,
                    occurred,
                    body.context,
                    body.notes,
                    json.dumps(body.quotes),
                    body.workaround,
                    body.pain_cost,
                    body.objections,
                    json.dumps(assumption_ids),
                    body.ai_summary,
                ),
            )
            self._conn.commit()
        self.touch_workspace(workspace_id)
        self.sync_lifecycle(workspace_id)
        return InterviewNote(
            id=interview_id,
            workspace_id=workspace_id,
            person_label=body.person_label,
            segment=body.segment,
            occurred_at=body.occurred_at,
            context=body.context,
            notes=body.notes,
            quotes=body.quotes,
            workaround=body.workaround,
            pain_cost=body.pain_cost,
            objections=body.objections,
            assumption_ids=assumption_ids,
            ai_summary=body.ai_summary,
        )

    def update_interview(
        self, workspace_id: str, interview_id: str, body: UpdateInterviewRequest
    ) -> InterviewNote | None:
        current = self.get_interview(workspace_id, interview_id)
        if current is None:
            return None
        patch = body.model_dump(exclude_unset=True)
        if "assumption_ids" in patch:
            patch["assumption_ids"] = self._require_assumption_ids(
                workspace_id, patch["assumption_ids"]
            )
        updated = current.model_copy(update=patch)
        occurred = updated.occurred_at.isoformat() if updated.occurred_at else None
        with self._lock:
            self._conn.execute(
                """
                UPDATE interview_notes
                SET person_label = ?, segment = ?, occurred_at = ?, context = ?, notes = ?,
                    quotes_json = ?, workaround = ?, pain_cost = ?, objections = ?,
                    assumption_ids_json = ?, ai_summary = ?
                WHERE id = ? AND workspace_id = ?
                """,
                (
                    updated.person_label,
                    updated.segment,
                    occurred,
                    updated.context,
                    updated.notes,
                    json.dumps(updated.quotes),
                    updated.workaround,
                    updated.pain_cost,
                    updated.objections,
                    json.dumps(updated.assumption_ids),
                    updated.ai_summary,
                    interview_id,
                    workspace_id,
                ),
            )
            self._conn.commit()
        self.touch_workspace(workspace_id)
        self.sync_lifecycle(workspace_id)
        return updated

    def delete_interview(self, workspace_id: str, interview_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM interview_notes WHERE id = ? AND workspace_id = ?",
                (interview_id, workspace_id),
            )
            self._conn.commit()
            deleted = cur.rowcount > 0
        if deleted:
            self.touch_workspace(workspace_id)
            self.sync_lifecycle(workspace_id)
        return deleted

    def sync_lifecycle(self, workspace_id: str) -> Workspace | None:
        workspace = self.get_workspace(workspace_id)
        if workspace is None:
            return None
        version = self.get_current_version(workspace_id)
        if version is None:
            return workspace
        evidence = self.list_evidence(workspace_id)
        experiments = self.list_experiments(workspace_id)
        interviews = self.list_interviews(workspace_id)
        readiness = evaluate_readiness(version.worksheet, evidence)
        lifecycle = compute_lifecycle(
            run_count=self.count_runs(workspace_id),
            readiness_level=readiness.level,
            experiments=experiments,
            interviews=interviews,
            evidence=evidence,
        )
        if lifecycle != workspace.lifecycle:
            return self.update_lifecycle(workspace_id, lifecycle)
        return workspace

    @staticmethod
    def _row_to_version(row: tuple) -> WorksheetVersion:
        return WorksheetVersion(
            id=row[0],
            workspace_id=row[1],
            version=row[2],
            worksheet=IdeaWorksheet.model_validate_json(row[3]),
            generated_document=row[4],
            change_summary=row[5],
            parent_version_id=row[6],
            created_at=datetime.fromisoformat(row[7]),
        )

    @staticmethod
    def _row_to_assumption(row: tuple) -> Assumption:
        return Assumption(
            id=row[0],
            workspace_id=row[1],
            statement=row[2],
            type=row[3],
            status=row[4],
            confidence=row[5],
            disconfirming_criteria=row[6],
            worksheet_version_id=row[7],
            sort_order=row[8],
        )

    @staticmethod
    def _row_to_experiment(row: tuple) -> Experiment:
        return Experiment(
            id=row[0],
            workspace_id=row[1],
            title=row[2],
            hypothesis=row[3],
            assumption_id=row[4],
            method=row[5],
            target=row[6],
            pass_fail_threshold=row[7],
            start_date=row[8],
            due_date=row[9],
            result=row[10],
            decision=row[11],
            status=row[12],
        )

    @staticmethod
    def _row_to_evidence(row: tuple) -> Evidence:
        occurred = datetime.fromisoformat(row[6]) if row[6] else None
        return Evidence(
            id=row[0],
            workspace_id=row[1],
            type=row[2],
            strength=row[3],
            source=row[4],
            content=row[5],
            occurred_at=occurred,
            assumption_ids=json.loads(row[7] or "[]"),
            experiment_id=row[8],
            worksheet_version_id=row[9],
        )

    @staticmethod
    def _row_to_interview(row: tuple) -> InterviewNote:
        occurred = datetime.fromisoformat(row[4]) if row[4] else None
        return InterviewNote(
            id=row[0],
            workspace_id=row[1],
            person_label=row[2],
            segment=row[3],
            occurred_at=occurred,
            context=row[5],
            notes=row[6],
            quotes=json.loads(row[7] or "[]"),
            workaround=row[8],
            pain_cost=row[9],
            objections=row[10],
            assumption_ids=json.loads(row[11] or "[]"),
            ai_summary=row[12],
        )

    def close(self) -> None:
        self._conn.close()


_store: WorkspaceStore | None = None


def get_workspace_store() -> WorkspaceStore:
    global _store
    if _store is None:
        _store = WorkspaceStore()
    return _store
