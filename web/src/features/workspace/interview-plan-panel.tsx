"use client";

import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";

import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

type InterviewQuestion = { question: string; rationale: string };

type InterviewPlanPanelProps = {
  workspaceId: string;
  questions: InterviewQuestion[];
  questionsMutation: Pick<
    UseMutationResult<{ questions: InterviewQuestion[] }, Error, void, unknown>,
    "mutate" | "isPending"
  >;
  onDismiss: () => void;
};

export function InterviewPlanPanel({
  workspaceId,
  questions,
  questionsMutation,
  onDismiss,
}: InterviewPlanPanelProps) {
  return (
    <Card className="space-y-4 border-cta/30 p-5">
      <h2 className="font-sans text-section font-semibold text-ink">Plan first interview</h2>
      <p className="font-sans text-body text-ink-muted">
        Customer discovery starts here. Use Mom Test questions about past behavior, not
        hypotheticals.
      </p>
      {questions.length === 0 ? (
        <Button
          type="button"
          onClick={() => questionsMutation.mutate()}
          disabled={questionsMutation.isPending}
        >
          {questionsMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="mr-2 size-4" aria-hidden />
          )}
          Suggest interview questions
        </Button>
      ) : (
        <ul className="space-y-2 font-sans text-sm text-ink">
          {questions.map((q) => (
            <li key={q.question} className="rounded-ui border border-rule-soft p-3">
              <span className="font-medium">{q.question}</span>
              <span className="mt-1 block text-ink-muted">{q.rationale}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/workspaces/${workspaceId}/validation`}>Go to validation</Link>
        </Button>
        <Button type="button" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
