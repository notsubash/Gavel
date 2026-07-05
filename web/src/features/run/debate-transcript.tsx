import { speakerMeta } from "@/lib/sse/judges";
import type { DebateTurnView } from "@/lib/sse/types";
import { cn } from "@/lib/utils";

import { RUN_PAGE_COPY } from "./run-page-copy";

/** ponytail: first sentence only; upgrade path is LLM one-liner per turn. */
function hearingExcerpt(content: string, maxLength = 160): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  const sentence = (match?.[1] ?? trimmed).trim();
  if (sentence.length <= maxLength) return sentence;
  return `${sentence.slice(0, maxLength - 3).trim()}…`;
}

function DebateTurnCompact({ turn }: { turn: DebateTurnView }) {
  const meta = speakerMeta(turn.speaker);
  const accentText = meta.accentClass.split(" ")[0];
  const excerpt = hearingExcerpt(turn.content);
  const label =
    "lensTag" in meta ? `${meta.name} · ${meta.lensTag}` : meta.name;

  return (
    <details className="group border-b border-rule-soft py-2 last:border-b-0">
      <summary
        className="cursor-pointer list-none marker:content-none"
        aria-label={`Round ${turn.round}: ${label}`}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pr-6">
          <span className="font-mono text-[11px] text-ink-subtle">R{turn.round}</span>
          <span className={cn("font-sans text-sm font-semibold", accentText)}>{label}</span>
          {turn.thinking && (
            <span className="font-sans text-xs text-ink-muted">Thinking…</span>
          )}
          {!turn.thinking && excerpt && (
            <span className="min-w-0 flex-1 basis-full font-sans text-sm text-ink-muted group-open:hidden">
              {excerpt}
              {turn.streaming && (
                <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-cta" aria-hidden />
              )}
            </span>
          )}
        </div>
      </summary>
      {turn.content ? (
        <p className="mt-2 whitespace-pre-wrap pl-6 font-sans text-sm leading-relaxed text-ink">
          {turn.content}
          {turn.streaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-cta" aria-hidden />
          )}
        </p>
      ) : turn.thinking ? (
        <p className="mt-2 animate-pulse pl-6 font-sans text-sm text-ink-muted">
          Preparing response…
        </p>
      ) : null}
    </details>
  );
}

export function DebateTurn({ turn }: { turn: DebateTurnView }) {
  if (true) {
    return <DebateTurnCompact turn={turn} />;
  }

  const meta = speakerMeta(turn.speaker);
  const accentText = meta.accentClass.split(" ")[0];

  return (
    <article
      className="border-l-2 border-primary py-3 pl-4"
      aria-label={`${meta.name}, round ${turn.round}`}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn("font-sans text-sm font-bold", accentText)}>{meta.name}</span>
        <span className="font-mono text-xs text-ink-subtle">Round {turn.round}</span>
        {turn.thinking && (
          <span className="font-sans text-xs text-ink-muted">Thinking…</span>
        )}
      </header>
      {turn.content ? (
        <p className="mt-2 whitespace-pre-wrap font-mono text-sm leading-relaxed text-ink">
          {turn.content}
          {turn.streaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-cta" aria-hidden />
          )}
        </p>
      ) : turn.thinking ? (
        <p className="mt-2 animate-pulse font-sans text-sm text-ink-muted">Preparing response…</p>
      ) : null}
    </article>
  );
}

export function DebateTranscript({
  turns,
  currentRound,
}: {
  turns: DebateTurnView[];
  currentRound: number | null;
}) {
  if (turns.length === 0 && currentRound === null) {
    return (
      <p className="font-sans text-sm text-ink-subtle">
        The debate transcript will appear here once the judges start arguing.
      </p>
    );
  }

  const rounds = [...new Set(turns.map((t) => t.round))].sort((a, b) => a - b);
  if (currentRound !== null && !rounds.includes(currentRound)) {
    rounds.push(currentRound);
    rounds.sort((a, b) => a - b);
  }

  const compact = true;

  return (
    <div className={compact ? "divide-y divide-rule-soft rounded border border-rule-soft px-4" : "space-y-8"}>
      {rounds.map((round) => {
        const roundTurns = turns.filter((t) => t.round === round);
        return (
          <section
            key={round}
            aria-labelledby={`debate-round-${round}`}
            className={compact ? "py-3" : "animate-round-enter"}
          >
            <h3
              id={`debate-round-${round}`}
              className={cn(
                "font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted",
                compact && "mb-1 px-0",
              )}
            >
              {compact ? `${RUN_PAGE_COPY.debateTranscript} — round ${round}` : `Round ${round}`}
            </h3>
            <div className={compact ? "space-y-0" : "mt-3 space-y-2"}>
              {roundTurns.length > 0 ? (
                roundTurns.map((turn) => (
                  <DebateTurn key={`${turn.round}-${turn.speaker}`} turn={turn} />
                ))
              ) : (
                <p className="font-sans text-sm text-ink-subtle">Round starting…</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
