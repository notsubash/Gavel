import Link from "next/link";

import { GavelLogo } from "@/components/gavel-logo";
import { ContributionGraph } from "@/features/marketing/contribution-graph";
import { LandingVerdictVisual } from "@/features/marketing/landing-verdict-visual";
import { JUDGE_META } from "@/lib/sse/judges";
import type { JudgeId } from "@/lib/sse/types";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";

const JUDGE_IDS: JudgeId[] = ["vc", "engineer", "pm", "customer", "competitor"];

const STEPS = [
  {
    title: "Draft the case",
    body: "Turn a rough startup idea into a structured worksheet Gavel's panel can judge.",
  },
  {
    title: "Build the evidence trail",
    body: "Track assumptions, interviews, experiments, and judge asks as contributions in Gavel.",
  },
  {
    title: "Face the judges",
    body: "Five AI lenses debate the idea, score it, and show the proof needed to change their minds.",
  },
];

export function LandingPage() {
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <nav
        className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-8"
        aria-label="Marketing"
      >
        <Link
          href="/"
          className="inline-flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
        >
          <GavelLogo size={36} showName />
        </Link>
        <Link
          href="/workspaces"
          className="inline-flex min-h-11 items-center rounded-ui px-3 font-sans text-sm font-semibold text-ink-muted transition-colors duration-200 hover:bg-paper-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
        >
          Open app
        </Link>
      </nav>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:px-8 md:py-16">
        <div className="max-w-2xl">
          <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
            Gavel
          </p>
          <h1 className="mt-4 font-sans text-display-home font-semibold tracking-tight text-ink lg:text-display-lg">
            Put your startup idea on trial.
          </h1>
          <p className="mt-5 font-sans text-lg leading-relaxed text-ink-muted">
            Gavel turns messy founder notes into a case file, gathers evidence, and lets five
            AI judges debate what will break first.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/workspaces/new">Start free</Link>
            </Button>
            <Link
              href="#how-it-works"
              className="inline-flex min-h-11 items-center rounded-ui border border-rule-soft bg-card px-5 py-3 font-sans text-base font-semibold text-ink transition-colors duration-200 hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
            >
              How Gavel works
            </Link>
          </div>
        </div>
        <LandingVerdictVisual className="mx-auto w-full max-w-md md:mx-0 md:justify-self-end" />
      </section>

      <section
        id="how-it-works"
        className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8"
        aria-labelledby="how-it-works-heading"
      >
        <div className="border-t border-rule-soft pt-10">
          <h2
            id="how-it-works-heading"
            className="font-sans text-section font-semibold text-ink"
          >
            How Gavel works
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <article key={step.title} className="rounded-ui border border-rule-soft bg-card p-5">
                <span className="font-mono text-sm font-bold text-cta">
                  0{index + 1}
                </span>
                <h3 className="mt-3 font-sans text-lg font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-ink-muted">
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8"
        aria-labelledby="contribution-section-heading"
      >
        <h2 id="contribution-section-heading" className="sr-only">
          Your validation trail
        </h2>
        <ContributionGraph />
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8" aria-labelledby="judges-heading">
        <div className="grid gap-6 rounded-ui border border-rule-soft bg-card p-5 md:grid-cols-[0.75fr_1fr] md:p-6">
          <div>
            <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
              The panel
            </p>
            <h2 id="judges-heading" className="mt-2 font-sans text-section font-semibold text-ink">
              Five judges, five ways to fail.
            </h2>
            <p className="mt-3 font-sans text-sm leading-relaxed text-ink-muted">
              Gavel separates funding, feasibility, product, customer, and competitor risk so
              the next action is obvious.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {JUDGE_IDS.map((id) => {
              const judge = JUDGE_META[id];
              return (
                <article
                  key={id}
                  className={cn(
                    "rounded-ui border bg-paper p-3",
                    judge.accentClass,
                  )}
                >
                  <p className="font-sans text-sm font-semibold">{judge.name}</p>
                  <p className="mt-1 font-sans text-xs font-medium text-ink">
                    {judge.lensTag}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:pb-16">
        <div className="rounded-ui border border-cta/30 bg-cta/10 p-6 text-center">
          <h2 className="font-sans text-section font-semibold text-ink">
            Stop guessing. Let Gavel put it on the stand.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl font-sans text-sm leading-relaxed text-ink-muted">
            Start with a worksheet, collect the missing proof, then let Gavel&apos;s panel tell
            you what to fix before you build.
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link href="/workspaces/new">Start free</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule-soft py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 font-sans text-sm text-ink-muted md:px-8">
          <GavelLogo size={28} showName />
          <Link href="/workspaces" className="font-semibold text-cta hover:underline">
            Open app
          </Link>
        </div>
      </footer>
    </main>
  );
}
