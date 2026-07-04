"""SQLite-backed workspace persistence."""

from __future__ import annotations

from datetime import UTC, datetime
import sqlite3
import threading
from uuid import uuid4

from config import PROJECT_ROOT
from validation.compose import compose_generated_document
from validation.schemas import (
    Assumption,
    IdeaWorksheet,
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

    def close(self) -> None:
        self._conn.close()


_store: WorkspaceStore | None = None


def get_workspace_store() -> WorkspaceStore:
    global _store
    if _store is None:
        _store = WorkspaceStore()
    return _store
