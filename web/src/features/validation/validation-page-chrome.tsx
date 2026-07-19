export function ValidationPageChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
          Case
        </p>
        <h1 className="font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
          Evidence
        </h1>
        <p className="max-w-prose font-sans text-body text-ink-muted">
          Collect proof against the riskiest assumptions before you start a review.
        </p>
      </header>

      {children}
    </div>
  );
}
