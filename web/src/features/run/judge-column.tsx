"use client";

import { AlertCircle } from "lucide-react";

import { JUDGE_META } from "@/lib/sse/judges";
import type { JudgeView, JudgeId, Verdict } from "@/lib/sse/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";

import { ScoreDeltaBadge } from "../appeal/score-delta-badge";

import { JudgeProfileChip } from "./judge-profile-chip";
import { RUN_PAGE_COPY } from "./run-page-copy";
import { VerdictStamp } from "./verdict-stamp";

function JudgeLensTag({ meta }: { meta: (typeof JUDGE_META)[JudgeId] }) {
  return (
    <span
      className={cn(
        "mt-2 inline-block border px-2 py-0.5 font-sans text-xs font-semibold uppercase tracking-wide",
        meta.accentClass,
      )}
      title={meta.lensTag}
    >
      {meta.lensTag}
    </span>
  );
}

export { JudgeLensTag };

export function JudgeColumnSkeleton({ judgeId }: { judgeId?: JudgeId } = {}) {
  const meta = judgeId ? JUDGE_META[judgeId] : null;
  const compact = true;

  return (
    <article
      className={cn(
        "flex flex-col border border-rule-soft p-4",
        compact ? "bg-paper-2" : "bg-card",
      )}
      aria-busy="true"
      aria-label={meta ? `${meta.name} — ${meta.lensTag} — loading` : "Judge verdict loading"}
    >
      {meta ? (
        <header>
          <h3 className={cn("font-sans text-sm font-bold", meta.accentClass.split(" ")[0])}>
            {meta.name}
          </h3>
          {!compact && (
            <>
              <p className="mt-1 font-sans text-xs text-ink-muted">{meta.role}</p>
              <JudgeLensTag meta={meta} />
            </>
          )}
        </header>
      ) : (
        <>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-3 w-full" />
        </>
      )}
      <Skeleton className="mt-6 h-16 w-full" />
      {!compact && <Skeleton className="mt-4 h-20 w-full" />}
      <Skeleton className="mt-3 h-12 w-full" />
      <Skeleton className="mt-4 h-10 w-28" />
    </article>
  );
}

function LegacyJudgeColumnBody({
  meta,
  verdict,
  scoreDelta,
  scoreChangeReason,
  evidenceAskCollides,
  evidenceAsk,
}: {
  meta: (typeof JUDGE_META)[JudgeId];
  verdict: NonNullable<JudgeView["verdict"]>;
  scoreDelta?: number | null;
  scoreChangeReason?: string | null;
  evidenceAskCollides: boolean;
  evidenceAsk: string | undefined;
}) {
  const scoreChangeReasonTrimmed = scoreChangeReason?.trim();
  const showScoreChangeReason =
    scoreChangeReasonTrimmed &&
    scoreDelta != null &&
    scoreDelta !== 0 &&
    scoreChangeReasonTrimmed !== evidenceAsk;

  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className={cn("font-sans text-sm font-bold", meta.accentClass.split(" ")[0])}>
            {meta.name}
          </h3>
          <p className="mt-1 font-sans text-xs text-ink-muted">{meta.role}</p>
          <JudgeLensTag meta={meta} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {scoreDelta != null && scoreDelta !== 0 && <ScoreDeltaBadge delta={scoreDelta} />}
          <p className="font-mono text-2xl font-bold tabular-nums text-ink">
            {verdict.score}
            <span className="text-sm font-normal text-ink-muted">/10</span>
          </p>
        </div>
      </header>

      <blockquote className="mt-6 border-l-2 border-primary pl-4 font-sans text-base italic leading-relaxed text-ink">
        {verdict.roast}
      </blockquote>

      <p className="mt-4 font-sans text-sm text-ink-muted">
        <span className="font-semibold text-ink">Key concern:</span> {verdict.key_concern}
      </p>

      {verdict.recommended_fix && (
        <p className="mt-3 font-sans text-sm text-ink-muted">
          <span className="font-semibold text-ink">Recommended fix:</span> {verdict.recommended_fix}
        </p>
      )}

      <p className="mt-3 font-sans text-sm text-ink-muted">
        <span className="font-semibold text-ink">Evidence ask:</span>{" "}
        {evidenceAsk || (
          <span className="text-ink-subtle italic">No explicit ask provided</span>
        )}
      </p>
      {evidenceAskCollides && (
        <p className="mt-1 font-sans text-xs text-ink-subtle" role="status">
          Same bar as another judge — use lens-specific proof when presenting evidence.
        </p>
      )}

      {showScoreChangeReason && (
        <p className="mt-3 font-sans text-sm text-ink-muted">
          <span className="font-semibold text-ink">Why it moved:</span> {scoreChangeReasonTrimmed}
        </p>
      )}
    </>
  );
}

function CompactJudgeColumnBody({
  judgeId,
  meta,
  verdict,
  baseline,
  scoreDelta,
  scoreChangeReason,
  evidenceAskCollides,
  evidenceAsk,
}: {
  judgeId: JudgeId;
  meta: (typeof JUDGE_META)[JudgeId];
  verdict: NonNullable<JudgeView["verdict"]>;
  baseline?: Verdict;
  scoreDelta?: number | null;
  scoreChangeReason?: string | null;
  evidenceAskCollides: boolean;
  evidenceAsk: string | undefined;
}) {
  const scoreChanged = scoreDelta != null && scoreDelta !== 0 && baseline;
  const scoreChangeReasonTrimmed = scoreChangeReason?.trim();
  const showScoreChangeReason =
    scoreChangeReasonTrimmed &&
    scoreChanged &&
    scoreChangeReasonTrimmed !== evidenceAsk;

  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <JudgeProfileChip judgeId={judgeId} verdict={verdict.verdict} showRole />
        <div className="flex flex-col items-end gap-1">
          {scoreDelta != null && scoreDelta !== 0 && <ScoreDeltaBadge delta={scoreDelta} />}
          <p className="font-mono text-2xl font-bold tabular-nums text-ink">
            {verdict.score}
            <span className="text-sm font-normal text-ink-muted">/10</span>
          </p>
        </div>
      </header>

      <p className="mt-4 font-sans text-sm font-medium leading-snug text-ink">
        {verdict.key_concern}
      </p>

      {showScoreChangeReason && (
        <p className="mt-2 font-sans text-sm text-ink-muted">
          <span className="font-semibold text-ink">Why it moved:</span> {scoreChangeReasonTrimmed}
        </p>
      )}

      {evidenceAsk && (
        <p className="mt-3 font-sans text-sm text-ink-muted">
          <span className="font-semibold text-ink">{RUN_PAGE_COPY.judgeProofNeeded}:</span>{" "}
          {evidenceAsk}
        </p>
      )}
      {evidenceAskCollides && (
        <p className="mt-1 font-sans text-xs text-ink-subtle" role="status">
          Same bar as another judge — use lens-specific proof when presenting evidence.
        </p>
      )}

      {scoreChanged && baseline && (
        <div className="mt-4 border-t border-rule-soft pt-3">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
            {RUN_PAGE_COPY.judgeBeforeDebate}
          </p>
          <p className="mt-1.5 font-sans text-sm text-ink-muted">
            <span className="font-mono font-semibold text-ink">{baseline.score}/10</span>
            {" · "}
            {baseline.key_concern}
          </p>
        </div>
      )}

      <details className="group mt-4">
        <summary className="cursor-pointer list-none font-sans text-xs font-semibold text-ink underline decoration-rule-soft underline-offset-4 marker:content-none">
          {RUN_PAGE_COPY.judgeFullRead}
        </summary>
        <div className="mt-3 space-y-3 border-l-2 border-rule-soft pl-3">
          <p className="font-sans text-sm italic leading-relaxed text-ink-muted">{verdict.roast}</p>
          {verdict.recommended_fix && (
            <p className="font-sans text-sm text-ink-muted">
              <span className="font-semibold text-ink">Fix:</span> {verdict.recommended_fix}
            </p>
          )}
        </div>
      </details>
    </>
  );
}

export function JudgeColumn({
  judgeId,
  view,
  animateStamp = false,
  scoreDelta,
  scoreChangeReason,
  evidenceAskCollides = false,
  baselineVerdict,
}: {
  judgeId: JudgeId;
  view: JudgeView;
  animateStamp?: boolean;
  /** When set, shows a delta badge beside the score (appeal or post-debate re-vote). */
  scoreDelta?: number | null;
  /** One-line justification when a post-debate score moved. */
  scoreChangeReason?: string | null;
  /** Normalized evidence ask matches another judge on the panel. */
  evidenceAskCollides?: boolean;
  /** Pre-debate verdict preserved through re-vote — shown when scores shift. */
  baselineVerdict?: Verdict;
}) {
  const meta = JUDGE_META[judgeId];
  const compact = true;

  if (view.status === "failed") {
    return (
      <article
        className="flex flex-col border border-rule-soft bg-paper-2 p-4"
        aria-label={`${meta.name} — ${meta.lensTag} — unavailable`}
      >
        {compact ? (
          <JudgeProfileChip judgeId={judgeId} showStance={false} showRole />
        ) : (
          <header>
            <h3 className={cn("font-sans text-sm font-bold", meta.accentClass.split(" ")[0])}>
              {meta.name}
            </h3>
            <p className="mt-1 font-sans text-xs text-ink-muted">{meta.role}</p>
            <JudgeLensTag meta={meta} />
          </header>
        )}
        <div className="mt-6 flex items-center gap-2 font-sans text-sm text-ink-muted">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          Verdict unavailable — the run ended before this judge finished.
        </div>
      </article>
    );
  }

  if (view.status === "idle" || view.status === "thinking") {
    return (
      <article
        className={cn(
          "flex flex-col border border-rule-soft p-4",
          compact ? "bg-paper-2" : "bg-card",
        )}
        aria-busy={view.status === "thinking"}
        aria-label={`${meta.name} — ${meta.lensTag}${view.status === "thinking" ? " — reading your pitch" : ""}`}
      >
        {compact ? (
          <JudgeProfileChip judgeId={judgeId} showStance={false} showRole />
        ) : (
          <header>
            <h3 className={cn("font-sans text-sm font-bold", meta.accentClass.split(" ")[0])}>
              {meta.name}
            </h3>
            <p className="mt-1 font-sans text-xs text-ink-muted">{meta.role}</p>
            <JudgeLensTag meta={meta} />
          </header>
        )}
        {view.status === "thinking" ? (
          <p className="mt-8 animate-pulse font-sans text-sm text-ink-muted">
            Reading your pitch…
          </p>
        ) : (
          <p className="mt-8 font-sans text-sm text-ink-subtle">Waiting for the panel…</p>
        )}
      </article>
    );
  }

  const { verdict } = view;
  if (!verdict) return <JudgeColumnSkeleton judgeId={judgeId} />;

  const evidenceAsk = verdict.evidence_to_change_verdict?.trim();

  return (
    <article
      className={cn(
        "flex flex-col border border-rule-soft p-4",
        compact ? "bg-paper-2" : "bg-card",
      )}
      aria-label={`${meta.name} — ${meta.lensTag} — ${verdict.verdict}`}
    >
      {compact ? (
        <CompactJudgeColumnBody
          judgeId={judgeId}
          meta={meta}
          verdict={verdict}
          baseline={baselineVerdict}
          scoreDelta={scoreDelta}
          scoreChangeReason={scoreChangeReason}
          evidenceAskCollides={evidenceAskCollides}
          evidenceAsk={evidenceAsk}
        />
      ) : (
        <LegacyJudgeColumnBody
          meta={meta}
          verdict={verdict}
          scoreDelta={scoreDelta}
          scoreChangeReason={scoreChangeReason}
          evidenceAskCollides={evidenceAskCollides}
          evidenceAsk={evidenceAsk}
        />
      )}

      <div className="mt-6">
        <VerdictStamp verdict={verdict.verdict} animate={animateStamp} />
      </div>
    </article>
  );
}
