#!/usr/bin/env python3
"""Migrate legacy runs into workspaces (Phase 4).

Groups runs by lineage root, creates one workspace per root from stored request_json,
links all runs via workspace_runs, and rewrites request_json to workspace-first shape.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import json
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from api.run_store import RunStore  # noqa: E402
from api.schemas import CreateRunRequest  # noqa: E402
from api.workspace_store import WorkspaceStore  # noqa: E402
from validation.legacy import LegacyCreateRunRequest, legacy_request_to_worksheet  # noqa: E402


def _lineage_root(run_id: str, parent_map: dict[str, str | None]) -> str:
    seen: set[str] = set()
    current = run_id
    while True:
        if current in seen:
            return run_id
        seen.add(current)
        parent = parent_map.get(current)
        if not parent:
            return current
        current = parent


def migrate(*, runs_db: Path, workspaces_db: Path, dry_run: bool = False) -> int:
    run_store = RunStore(runs_db)
    ws_store = WorkspaceStore(workspaces_db)

    with sqlite3.connect(runs_db) as conn:
        rows = conn.execute(
            "SELECT run_id, request_json FROM runs ORDER BY created_at ASC"
        ).fetchall()

    parent_map: dict[str, str | None] = {}
    legacy_by_run: dict[str, LegacyCreateRunRequest] = {}
    for run_id, request_json in rows:
        data = json.loads(request_json)
        if "workspace_id" in data:
            continue
        legacy = LegacyCreateRunRequest.model_validate(data)
        parent_map[run_id] = legacy.parent_run_id
        legacy_by_run[run_id] = legacy

    if not legacy_by_run:
        print("No legacy runs to migrate.")
        return 0

    groups: dict[str, list[str]] = defaultdict(list)
    for run_id in legacy_by_run:
        root = _lineage_root(run_id, parent_map)
        groups[root].append(run_id)

    migrated = 0
    for root_id, run_ids in groups.items():
        if ws_store.get_run_link(root_id):
            for run_id in run_ids:
                if not ws_store.get_run_link(run_id):
                    link = ws_store.get_run_link(root_id)
                    if link and not dry_run:
                        ws_store.link_run(run_id, link[0], link[1])
            continue

        worksheet = legacy_request_to_worksheet(legacy_by_run[root_id])
        if dry_run:
            print(f"[dry-run] would create workspace for lineage root {root_id}")
            migrated += len(run_ids)
            continue

        workspace, version, _ = ws_store.create_workspace(worksheet)
        for run_id in sorted(run_ids, key=lambda rid: legacy_by_run[rid].version):
            legacy = legacy_by_run[run_id]
            ws_store.link_run(run_id, workspace.id, version.id)
            new_request = CreateRunRequest(
                workspace_id=workspace.id,
                worksheet_version_id=version.id,
                model_runtime=legacy.model_runtime,  # type: ignore[arg-type]
                execution_flow="deterministic",
                max_debate_rounds=legacy.max_debate_rounds,
                enable_web_search=legacy.enable_web_search,
                parent_run_id=legacy.parent_run_id,
                version=legacy.version,
            )
            with sqlite3.connect(runs_db) as conn:
                conn.execute(
                    "UPDATE runs SET request_json = ? WHERE run_id = ?",
                    (new_request.model_dump_json(), run_id),
                )
                conn.commit()
        ws_store.sync_lifecycle(workspace.id)
        migrated += len(run_ids)
        print(f"Migrated {len(run_ids)} run(s) -> workspace {workspace.id}")

    run_store.close()
    ws_store.close()
    return migrated


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate legacy runs to workspaces")
    parser.add_argument("--runs-db", type=Path, default=ROOT / "data" / "runs.db")
    parser.add_argument("--workspaces-db", type=Path, default=ROOT / "data" / "workspaces.db")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    count = migrate(runs_db=args.runs_db, workspaces_db=args.workspaces_db, dry_run=args.dry_run)
    print(f"Done. Touched {count} legacy run(s).")


if __name__ == "__main__":
    main()
