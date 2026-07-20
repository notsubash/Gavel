/**
 * CSS mock of the completed Verdict climax — trust visual for the landing hero.
 * Uses product tokens so it reads as Gavel, not a generic icon grid.
 */
export function LandingVerdictVisual({ className }: { className?: string }) {
  return (
    <figure
      className={className}
      aria-label="Example verdict from a completed Gavel review"
    >
      <div
        className="origin-center rotate-1 rounded-ui border border-rule-soft bg-card p-1 shadow-soft motion-safe:transition-transform motion-safe:duration-300 md:-rotate-2 md:hover:rotate-0"
      >
        <div className="overflow-hidden rounded-ui border border-rule-soft ring-1 ring-cta/15">
          <header className="border-b border-rule-soft border-l-[6px] border-l-cta bg-paper-2 px-5 py-4">
            <p className="font-sans text-meta font-semibold uppercase tracking-widest text-ink-muted">
              Recommendation
            </p>
            <p className="mt-2 font-sans text-2xl font-semibold text-conditional">Iterate</p>
            <p className="mt-1 font-sans text-meta text-ink-muted">MEDIUM confidence</p>
            <p className="mt-3 max-w-prose font-sans text-sm leading-relaxed text-ink">
              Buyers nod along in demos, but nobody has paid to keep the workflow.
            </p>
          </header>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card px-5 py-4">
            <div>
              <p className="font-sans text-sm font-semibold text-ink">Present evidence</p>
              <p className="mt-1 font-sans text-xs text-ink-muted">
                One next step after the verdict.
              </p>
            </div>
            <span className="inline-flex min-h-11 items-center rounded-ui border border-rule-soft bg-card px-4 py-2 font-sans text-sm font-semibold text-ink">
              Submit evidence
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center font-sans text-xs text-ink-subtle md:text-left">
        Real product UI — verdict, why, and one next action.
      </figcaption>
    </figure>
  );
}
