"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";

import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

type WeeklyDigest = {
  summary: string;
  highlights: string[];
  open_questions: string[];
  evidence_count: number;
};

type WeeklyReviewSectionProps = {
  digest: WeeklyDigest | null;
  weeklyMutation: Pick<
    UseMutationResult<WeeklyDigest, Error, void, unknown>,
    "mutate" | "isPending"
  >;
};

export function WeeklyReviewSection({ digest, weeklyMutation }: WeeklyReviewSectionProps) {
  return (
    <section aria-labelledby="weekly-review-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="weekly-review-heading" className="font-sans text-section font-semibold text-ink">
          Weekly review
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => weeklyMutation.mutate()}
          disabled={weeklyMutation.isPending}
          aria-busy={weeklyMutation.isPending || undefined}
        >
          {weeklyMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="mr-2 size-4" aria-hidden />
          )}
          Review week
        </Button>
      </div>
      <Card className="mt-3 p-5">
        {digest ? (
          <div className="space-y-3 font-sans text-body text-ink">
            <p>{digest.summary}</p>
            {digest.highlights.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
                {digest.highlights.map((h, i) => (
                  <li key={`${i}-${h.slice(0, 32)}`}>{h}</li>
                ))}
              </ul>
            )}
            {digest.open_questions.length > 0 && (
              <p className="text-sm text-ink-muted">
                <span className="font-medium text-ink">Open questions: </span>
                {digest.open_questions.join(" · ")}
              </p>
            )}
            <p className="text-meta text-ink-subtle">
              {digest.evidence_count} evidence item(s) in the last 7 days
            </p>
          </div>
        ) : (
          <p className="font-sans text-body text-ink-muted">
            Summarize evidence added, assumptions moved, and experiments completed this week.
          </p>
        )}
      </Card>
    </section>
  );
}
