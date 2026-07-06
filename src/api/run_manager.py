"""Run engine decoupled from the HTTP connection.

A ``RunManager`` drives ``stream_pipeline`` to completion exactly once per run,
buffering every event in a durable SQLite log. HTTP clients are pure subscribers:
they replay the log and then await new events. This means a browser can
disconnect and reconnect, or several tabs can watch the same run, without the
run dying or a second viewer getting rejected.
"""

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime
import logging
from pathlib import Path
import threading
import time
from uuid import uuid4

from api import workspace_store
from api.deps import (
    RunRecord,
    build_idea_preview,
    build_model_for_run,
    build_research_context_for_run,
    build_startup_idea_context,
    get_idea_store,
)
from api.events import (
    research_findings_envelope,
    run_cancelled_envelope,
    run_failed_envelope,
    stream_connected_envelope,
    to_api_envelope,
)
from api.run_store import RunStore
from api.schemas import ApiEventEnvelope, CreateRunRequest, SimilarRunItem, VerdictSummary
from appeal.service import AppealResult, run_appeal
from config import Settings, get_settings
from debate.revote import appeal_baseline_panel
from events import RunMetrics
from judges.confidence import (
    confidence_before_after,
    confidence_snapshot_from_debate,
    confidence_snapshot_from_structured,
)
from judges.schemas import RoastPanel, Verdict
from memory.identity import LOCAL_USER
from memory.retrieval import records_for_memory
from observability.metrics import log_run_metrics
from pipeline import stream_pipeline
from research.service import format_research_context
from run_control import RunAbort
from validation.ingest import build_run_handoff
from validation.readiness import evaluate_readiness

logger = logging.getLogger(__name__)


def _verdict_summary_from_panel(panel: dict) -> VerdictSummary | None:
    verdicts = panel.get("verdicts")
    if not isinstance(verdicts, list) or not verdicts:
        return None
    counts = {"pass": 0, "fail": 0, "conditional": 0}
    scores: list[float] = []
    for item in verdicts:
        if not isinstance(item, dict):
            continue
        label = str(item.get("verdict", "")).lower()
        if label in counts:
            counts[label] += 1
        score = item.get("score")
        if isinstance(score, (int, float)):
            scores.append(float(score))
    if not any(counts.values()):
        return None
    avg = sum(scores) / len(scores) if scores else None
    return VerdictSummary(
        pass_count=counts["pass"],
        fail_count=counts["fail"],
        conditional_count=counts["conditional"],
        avg_score=round(avg, 1) if avg is not None else None,
    )


def _effective_panel_for_run(store: RunStore, run_id: str) -> dict | None:
    appeal = store.get_latest_event(run_id, "appeal_completed")
    if appeal is not None:
        revised = appeal.payload.get("revised_panel")
        if isinstance(revised, dict):
            return revised

    completed = store.get_latest_event(run_id, "run_completed")
    if completed is None:
        return None
    debate_result = completed.payload.get("debate_result")
    if isinstance(debate_result, dict):
        revised = debate_result.get("revised_verdicts")
        if isinstance(revised, list) and revised:
            return {"verdicts": revised}
    roast_panel = completed.payload.get("roast_panel")
    if isinstance(roast_panel, dict):
        return roast_panel
    return None


def _summary_for_completed_run(store: RunStore, run_id: str) -> VerdictSummary | None:
    panel = _effective_panel_for_run(store, run_id)
    if panel is None:
        return None
    return _verdict_summary_from_panel(panel)


class _RunState:
    """Per-run lifecycle and subscriber wake-ups (event-loop owned)."""

    def __init__(
        self,
        record: RunRecord,
        *,
        store: RunStore,
        done: bool = False,
    ) -> None:
        self.record = record
        self._store = store
        self.done = done
        self.task: asyncio.Task | None = None
        self._subscribers: set[asyncio.Event] = set()
        self._cancel = threading.Event()

    def append(self, envelope: ApiEventEnvelope) -> ApiEventEnvelope:
        envelope = self._store.append_event(self.record.run_id, envelope)
        for wakeup in self._subscribers:
            wakeup.set()
        return envelope

    def append_once(self, envelope: ApiEventEnvelope, *, guard_type: str) -> ApiEventEnvelope:
        envelope = self._store.append_event_once(
            self.record.run_id, envelope, guard_type=guard_type
        )
        for wakeup in self._subscribers:
            wakeup.set()
        return envelope

    def finish(self) -> None:
        self.done = True
        for wakeup in self._subscribers:
            wakeup.set()

    def add_subscriber(self, wakeup: asyncio.Event) -> None:
        self._subscribers.add(wakeup)

    def remove_subscriber(self, wakeup: asyncio.Event) -> None:
        self._subscribers.discard(wakeup)

    def request_cancel(self) -> None:
        self._cancel.set()


class RunManager:
    def __init__(
        self,
        db_path: Path | None = None,
        *,
        recover_on_init: bool = True,
        stale_minutes: int | None = None,
    ) -> None:
        self._store = RunStore(db_path)
        self._runs: dict[str, _RunState] = {}
        self._stale_minutes = (
            stale_minutes if stale_minutes is not None else get_settings().stale_run_minutes
        )
        if recover_on_init:
            self.recover_stale_runs()

    def recover_stale_runs(self) -> list[str]:
        recovered = self._store.recover_stale_runs(self._stale_minutes)
        for run_id in recovered:
            state = self._runs.get(run_id)
            if state is not None:
                state.record.status = "failed"
                state.finish()
        return recovered

    def close(self) -> None:
        self._store.close()

    def create(self, request: CreateRunRequest) -> RunRecord:
        ws_store = workspace_store.get_workspace_store()
        workspace = ws_store.get_workspace(request.workspace_id)
        if workspace is None:
            raise ValueError(f"workspace {request.workspace_id!r} not found")

        version_id = request.worksheet_version_id or workspace.current_version_id
        if version_id is None:
            raise ValueError("workspace has no worksheet version")
        version = ws_store.get_version(version_id)
        if version is None or version.workspace_id != request.workspace_id:
            raise ValueError(f"worksheet version {version_id!r} not found")

        if not request.readiness_override:
            readiness = evaluate_readiness(
                version.worksheet,
                ws_store.list_evidence(request.workspace_id),
                has_prior_run=ws_store.count_runs(request.workspace_id) > 0,
                worksheet_changed_since_run=ws_store.worksheet_changed_since_last_run(
                    request.workspace_id
                ),
            )
            if not readiness.can_run_judges:
                raise ValueError(
                    f"Readiness gate blocked roast ({readiness.level}). "
                    "Set readiness_override=true to run anyway."
                )

        version_num = 1
        parent_run_id = request.parent_run_id
        if parent_run_id:
            parent = self.get(parent_run_id)
            if parent is None:
                raise ValueError(f"parent run {parent_run_id!r} not found")
            if parent.request.workspace_id != request.workspace_id:
                raise ValueError("parent run belongs to a different workspace")
            version_num = parent.request.version + 1

        request = request.model_copy(
            update={
                "version": version_num,
                "parent_run_id": parent_run_id,
                "worksheet_version_id": version_id,
            }
        )
        run_id = str(uuid4())
        record = RunRecord(run_id=run_id, request=request)
        self._store.insert_run(record)
        ws_store.link_run(run_id, request.workspace_id, version_id)
        ws_store.sync_lifecycle(request.workspace_id)
        self._runs[run_id] = _RunState(record, store=self._store)
        return record

    def _ingest_run_handoff(self, run_id: str) -> None:
        record = self.get(run_id)
        if record is None:
            return
        completed = self._store.get_latest_event(run_id, "run_completed")
        if completed is None:
            return
        roast_panel_raw = completed.payload.get("roast_panel")
        if not isinstance(roast_panel_raw, dict):
            return
        try:
            panel = RoastPanel.model_validate(roast_panel_raw)
        except Exception:
            logger.exception("Could not parse roast panel for handoff on run %s", run_id)
            return
        debate_result = completed.payload.get("debate_result")
        items = build_run_handoff(
            roast_panel=panel,
            debate_result=debate_result if isinstance(debate_result, dict) else None,
        )
        if not items:
            return
        ws_store = workspace_store.get_workspace_store()
        ws_store.save_run_handoff(run_id, record.request.workspace_id, items)

    def list_runs_for_workspace(
        self, workspace_id: str, *, limit: int = 20, offset: int = 0
    ) -> tuple[list[tuple[RunRecord, VerdictSummary | None]], int]:
        ws_store = workspace_store.get_workspace_store()
        run_ids, total = ws_store.list_run_ids(workspace_id, limit=limit, offset=offset)
        items: list[tuple[RunRecord, VerdictSummary | None]] = []
        for run_id in run_ids:
            record = self.get(run_id)
            if record is None:
                continue
            summary = (
                _summary_for_completed_run(self._store, run_id)
                if record.status == "completed"
                else None
            )
            items.append((record, summary))
        return items, total

    def get_effective_panel(self, run_id: str) -> dict | None:
        record = self.get(run_id)
        if record is None or record.status != "completed":
            return None
        return _effective_panel_for_run(self._store, run_id)

    def get_confidence_snapshot(self, run_id: str) -> dict | None:
        record = self.get(run_id)
        if record is None or record.status != "completed":
            return None

        appeal = self._store.get_latest_event(run_id, "appeal_completed")
        if appeal is not None:
            revised_structured = appeal.payload.get("revised_structured_synthesis")
            if isinstance(revised_structured, dict):
                revised_panel = appeal.payload.get("revised_panel")
                verdicts: list[Verdict] = []
                if isinstance(revised_panel, dict):
                    try:
                        verdicts = RoastPanel.model_validate(revised_panel).verdicts
                    except Exception:
                        verdicts = []
                snapshot = confidence_snapshot_from_structured(revised_structured, verdicts or None)
                return snapshot.model_dump(mode="json") if snapshot else None

        completed = self._store.get_latest_event(run_id, "run_completed")
        if completed is None:
            return None
        debate_result = completed.payload.get("debate_result")
        roast_panel = completed.payload.get("roast_panel")
        verdicts = []
        if isinstance(roast_panel, dict):
            try:
                verdicts = RoastPanel.model_validate(roast_panel).verdicts
            except Exception:
                verdicts = []
        snapshot = confidence_snapshot_from_debate(
            debate_result if isinstance(debate_result, dict) else None,
            verdicts or None,
        )
        return snapshot.model_dump(mode="json") if snapshot else None

    def get_debate_result(self, run_id: str) -> dict | None:
        completed = self._store.get_latest_event(run_id, "run_completed")
        if completed is None:
            return None
        debate_result = completed.payload.get("debate_result")
        return debate_result if isinstance(debate_result, dict) else None

    def get(self, run_id: str) -> RunRecord | None:
        state = self._runs.get(run_id)
        if state is not None:
            return state.record
        return self._store.get_run_record(run_id)

    def list_events(self, run_id: str) -> list[ApiEventEnvelope]:
        return self._store.list_events_after(run_id, -1)

    def list_runs(
        self, *, limit: int = 20, offset: int = 0
    ) -> tuple[list[tuple[RunRecord, VerdictSummary | None]], int]:
        records, total = self._store.list_runs(limit=limit, offset=offset)
        items: list[tuple[RunRecord, VerdictSummary | None]] = []
        for record in records:
            summary = (
                _summary_for_completed_run(self._store, record.run_id)
                if record.status == "completed"
                else None
            )
            items.append((record, summary))
        return items, total

    def list_similar_runs(self, run_id: str, *, limit: int = 3) -> list[SimilarRunItem]:
        record = self.get(run_id)
        if record is None:
            raise KeyError(run_id)

        store = get_idea_store()
        query_text = build_startup_idea_context(run_id, record.request)
        candidates = records_for_memory(store, LOCAL_USER, query_text, limit=limit + 1)
        items: list[SimilarRunItem] = []
        for idea in candidates:
            if idea.id == run_id:
                continue
            panel = idea.revised_panel or idea.roast_panel
            summary = _verdict_summary_from_panel(panel.model_dump(mode="json"))
            items.append(
                SimilarRunItem(
                    run_id=idea.id,
                    idea_preview=build_idea_preview(idea.idea_text),
                    created_at=idea.created_at,
                    verdict_summary=summary,
                )
            )
            if len(items) >= limit:
                break
        return items

    async def appeal(
        self,
        run_id: str,
        appeal_text: str,
        settings: Settings,
        target_judges: list[str] | None = None,
        experiment_context: dict | None = None,
    ) -> tuple[RoastPanel, AppealResult]:
        record = self.get(run_id)
        if record is None:
            raise KeyError(run_id)
        if record.status != "completed":
            raise ValueError("Run must be completed before submitting an appeal")
        if self._store.get_latest_event(run_id, "appeal_completed") is not None:
            raise ValueError("An appeal has already been submitted for this run")

        completed = self._store.get_latest_event(run_id, "run_completed")
        if completed is None:
            raise ValueError("Run has no completed results to appeal")

        debate_result = completed.payload.get("debate_result")
        if not isinstance(debate_result, dict):
            debate_result = {}

        roast_panel = appeal_baseline_panel(
            RoastPanel.model_validate(completed.payload["roast_panel"]),
            debate_result,
        )

        if settings.e2e_test_mode:
            from api.e2e_test_support import run_e2e_stub_appeal

            result = await asyncio.to_thread(
                run_e2e_stub_appeal,
                roast_panel,
                debate_result,
                appeal_text,
                target_judges,
            )
        else:
            model = build_model_for_run(record.request, settings)
            startup_idea = build_startup_idea_context(run_id, record.request)
            result = await asyncio.to_thread(
                run_appeal,
                model,
                startup_idea,
                roast_panel,
                debate_result,
                appeal_text,
                None,
                target_judges,
            )

        outcomes = result.evidence_outcomes
        movement = confidence_before_after(
            debate_result,
            result.revised_structured_synthesis,
            original_verdicts=roast_panel.verdicts,
            revised_verdicts=result.revised_panel.verdicts,
        )
        state = self._ensure_state(run_id)
        try:
            state.append_once(
                ApiEventEnvelope(
                    type="appeal_completed",
                    run_id=run_id,
                    sequence=0,
                    payload={
                        "appeal_text": appeal_text.strip(),
                        "original_panel": roast_panel.model_dump(mode="json"),
                        "revised_panel": result.revised_panel.model_dump(mode="json"),
                        "revised_synthesis": result.revised_synthesis,
                        "revised_structured_synthesis": result.revised_structured_synthesis,
                        "confidence_before_after": movement,
                        "experiment_context": experiment_context,
                        "target_judges": list(result.target_judges),
                        "evidence_outcomes": [
                            {
                                "judge": item.judge,
                                "evidence_ask": item.evidence_ask,
                                "outcome": item.outcome,
                                "targeted": item.targeted,
                                "score_delta": item.score_delta,
                            }
                            for item in outcomes
                        ],
                    },
                    created_at=datetime.now(UTC),
                ),
                guard_type="appeal_completed",
            )
        except ValueError as exc:
            raise ValueError("An appeal has already been submitted for this run") from exc
        return roast_panel, result

    def _ensure_state(self, run_id: str) -> _RunState:
        state = self._runs.get(run_id)
        if state is not None:
            return state
        record = self._store.get_run_record(run_id)
        if record is None:
            raise KeyError(run_id)
        terminal = record.status in ("completed", "failed", "cancelled")
        state = _RunState(record, store=self._store, done=terminal)
        self._runs[run_id] = state
        return state

    def _fail_interrupted(self, state: _RunState) -> None:
        """Engine task was lost (restart); fail cleanly instead of re-driving."""
        if self._store.fail_run(state.record.run_id) is None:
            return
        state.record.status = "failed"
        state.finish()

    def ensure_started(self, run_id: str, settings: Settings) -> None:
        """Start the run's background task once. Idempotent."""
        state = self._ensure_state(run_id)
        if state.record.status in ("completed", "failed", "cancelled"):
            return
        if state.task is not None:
            return
        if state.record.status == "running":
            self._fail_interrupted(state)
            return
        if state.record.status == "created":
            state.record.status = "running"
            self._store.update_status(run_id, "running")
        state.append(stream_connected_envelope(run_id=run_id))
        state.task = asyncio.create_task(self._drive(run_id, settings))

    def cancel(self, run_id: str) -> RunRecord:
        state = self._ensure_state(run_id)
        if state.record.status in ("completed", "failed", "cancelled"):
            raise ValueError("Run already finished")
        if state.record.status == "created":
            state.record.status = "cancelled"
            self._store.update_status(run_id, "cancelled")
            state.append(stream_connected_envelope(run_id=run_id))
            state.append(run_cancelled_envelope(run_id=run_id, sequence=0))
            state.finish()
            return state.record
        state.request_cancel()
        return state.record

    async def subscribe(
        self, run_id: str, *, after_sequence: int = -1
    ) -> AsyncIterator[ApiEventEnvelope]:
        """Replay persisted events after ``after_sequence``, then stream live."""
        state = self._ensure_state(run_id)
        wakeup = asyncio.Event()
        state.add_subscriber(wakeup)
        try:
            cursor = max(0, after_sequence + 1)
            while True:
                for envelope in self._store.list_events_after(run_id, cursor - 1):
                    yield envelope
                    cursor = envelope.sequence + 1
                if state.done:
                    # ponytail: fast-fail can append the terminal event after the query
                    # above; drain once more so run_failed is not dropped on CI.
                    for envelope in self._store.list_events_after(run_id, cursor - 1):
                        yield envelope
                        cursor = envelope.sequence + 1
                    return
                await wakeup.wait()
                wakeup.clear()
        finally:
            state.remove_subscriber(wakeup)

    async def _drive(self, run_id: str, settings: Settings) -> None:
        state = self._runs[run_id]
        loop = asyncio.get_running_loop()
        record = state.record

        def emit(envelope: ApiEventEnvelope) -> None:
            loop.call_soon_threadsafe(state.append, envelope)

        def work() -> None:
            started_at = time.monotonic()
            max_seconds = settings.max_run_seconds

            def abort_check() -> str | None:
                if state._cancel.is_set():
                    return "cancelled"
                if max_seconds > 0 and time.monotonic() - started_at > max_seconds:
                    return "budget_exceeded"
                return None

            if settings.e2e_test_mode:
                from api.e2e_test_support import stream_e2e_stub_pipeline

                events = stream_e2e_stub_pipeline(
                    max_debate_rounds=record.request.max_debate_rounds,
                    model_runtime=record.request.model_runtime,
                    abort_check=abort_check,
                )
                for event in events:
                    if isinstance(event, RunMetrics):
                        log_run_metrics(event.as_dict(), run_id=run_id)
                    emit(to_api_envelope(event, run_id=run_id, sequence=0))
                return

            startup_idea = build_startup_idea_context(run_id, record.request)
            model = build_model_for_run(record.request, settings)
            research = build_research_context_for_run(record.request, startup_idea, settings, model)
            if research is not None:
                emit(research_findings_envelope(run_id=run_id, sequence=0, context=research))
            research_context = format_research_context(research) if research is not None else None
            idea_store = get_idea_store()
            for event in stream_pipeline(
                model,
                startup_idea,
                max_debate_rounds=record.request.max_debate_rounds,
                user_id=LOCAL_USER,
                idea_store=idea_store,
                idea_id=run_id,
                research_context=research_context,
                model_runtime=record.request.model_runtime,
                abort_check=abort_check,
            ):
                if isinstance(event, RunMetrics):
                    log_run_metrics(event.as_dict(), run_id=run_id)
                emit(to_api_envelope(event, run_id=run_id, sequence=0))

        try:
            await asyncio.to_thread(work)
            event_types = {envelope.type for envelope in self._store.list_events_after(run_id, -1)}
            if "run_completed" in event_types:
                record.status = "completed"
                self._store.update_status(run_id, "completed")
                self._ingest_run_handoff(run_id)
                workspace_store.get_workspace_store().sync_lifecycle(record.request.workspace_id)
            elif state._cancel.is_set():
                record.status = "cancelled"
                self._store.update_status(run_id, "cancelled")
                if "run_cancelled" not in event_types:
                    state.append(run_cancelled_envelope(run_id=run_id, sequence=0))
            else:
                record.status = "completed"
                self._store.update_status(run_id, "completed")
        except RunAbort as exc:
            if exc.reason == "cancelled":
                record.status = "cancelled"
                self._store.update_status(run_id, "cancelled")
                state.append(run_cancelled_envelope(run_id=run_id, sequence=0))
            else:
                record.status = "failed"
                self._store.update_status(run_id, "failed")
                state.append(
                    run_failed_envelope(
                        run_id=run_id,
                        sequence=0,
                        message="Run exceeded the wall-clock budget. Please try again.",
                    )
                )
        except Exception:
            logger.exception("Run %s failed", run_id)
            record.status = "failed"
            self._store.update_status(run_id, "failed")
            state.append(
                run_failed_envelope(
                    run_id=run_id,
                    sequence=0,
                    message="The roast run failed. Please try again.",
                )
            )
        finally:
            state.finish()


_manager = RunManager(db_path=get_settings().runs_db_path)


def get_run_manager() -> RunManager:
    return _manager
