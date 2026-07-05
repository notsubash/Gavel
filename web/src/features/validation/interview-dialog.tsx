"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";

import type { ValidationMutations } from "./use-validation-mutations";

export function InterviewDialog({
  open,
  onOpenChange,
  mutations,
  questions,
  personLabel,
  interviewNotes,
  aiSummary,
  extractedQuotes,
  suggestedAssumptionIds,
  onPersonLabelChange,
  onNotesChange,
  onSummarizeSuccess,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: ValidationMutations;
  questions: { question: string; rationale: string }[];
  personLabel: string;
  interviewNotes: string;
  aiSummary: string | null;
  extractedQuotes: string[];
  suggestedAssumptionIds: string[];
  onPersonLabelChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSummarizeSuccess: (res: {
    summary: string;
    extracted_quotes: string[];
    suggested_assumption_ids: string[];
  }) => void;
  onReset: () => void;
}) {
  const { summarizeMutation, saveInterviewMutation } = mutations;

  const handleClose = (next: boolean) => {
    if (!next) onReset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Interview note</DialogTitle>
          <DialogDescription>
            Capture who you spoke with and what you learned. Summarize to extract quotes.
          </DialogDescription>
        </DialogHeader>

        {questions.length > 0 && (
          <div className="rounded-ui border border-rule-soft bg-paper-2 p-4">
            <p className="font-sans text-meta font-semibold uppercase tracking-wide text-ink-subtle">
              Suggested questions
            </p>
            <ul className="mt-2 space-y-2 font-sans text-sm text-ink">
              {questions.map((q) => (
                <li key={q.question}>
                  <span className="font-medium">{q.question}</span>
                  <span className="block text-ink-muted">{q.rationale}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="person-label">Person</Label>
          <Input
            id="person-label"
            value={personLabel}
            onChange={(e) => onPersonLabelChange(e.target.value)}
            placeholder="e.g. Solo SaaS founder, design partner"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interview-notes">Notes</Label>
          <Textarea
            id="interview-notes"
            rows={6}
            value={interviewNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Past behavior, workarounds, quotes..."
          />
        </div>

        {aiSummary && (
          <div className="rounded-ui border border-cta/20 bg-cta/5 p-4">
            <Badge variant="heat" className="mb-2">
              AI summary
            </Badge>
            <p className="font-sans text-sm text-ink">{aiSummary}</p>
          </div>
        )}

        {extractedQuotes.length > 0 && (
          <div className="rounded-ui border border-rule-soft bg-paper-2 p-4">
            <p className="font-sans text-meta font-semibold uppercase tracking-wide text-ink-subtle">
              Extracted quotes
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-sm text-ink">
              {extractedQuotes.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              summarizeMutation.mutate(
                { notes: interviewNotes, person_label: personLabel || undefined },
                {
                  onSuccess: (res) => {
                    onSummarizeSuccess(res);
                    if (res.extracted_quotes.length) {
                      toast.message(`${res.extracted_quotes.length} quote(s) extracted`);
                    }
                  },
                },
              )
            }
            disabled={interviewNotes.length < 20 || summarizeMutation.isPending}
          >
            {summarizeMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            Summarize
          </Button>
          <Button
            type="button"
            onClick={() =>
              saveInterviewMutation.mutate(
                {
                  person_label: personLabel,
                  notes: interviewNotes,
                  quotes: extractedQuotes,
                  assumption_ids: suggestedAssumptionIds,
                  segment: null,
                  occurred_at: null,
                  context: null,
                  workaround: null,
                  pain_cost: null,
                  objections: null,
                  ai_summary: aiSummary,
                },
                { onSuccess: () => handleClose(false) },
              )
            }
            disabled={
              !personLabel || interviewNotes.length < 10 || saveInterviewMutation.isPending
            }
          >
            {saveInterviewMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            Save interview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
