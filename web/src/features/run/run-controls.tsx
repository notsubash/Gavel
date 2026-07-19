"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Download, MoreHorizontal, OctagonX, Share2 } from "lucide-react";

import {
  buildTranscriptMarkdown,
  transcriptFilename,
  type TranscriptInput,
} from "@/lib/format/transcript-md";
import { ApiError } from "@/lib/api/client";
import { cancelRun } from "@/lib/api/runs";
import { parseApiDetail } from "@/lib/api/types-helpers";
import { secondaryCtaClass } from "@/lib/cta-classes";
import { RUN_PAGE_COPY } from "@/features/run/run-page-copy";
import { JUDGE_ORDER } from "@/lib/sse/types";
import type { RunStatus } from "@/lib/sse/types";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";

function canExportTranscript(input: TranscriptInput | null): boolean {
  if (!input) return false;
  return JUDGE_ORDER.some((id) => input.judges[id].verdict !== undefined);
}

export function RunControls({
  runId,
  status,
  onCancelSettled,
  exportInput,
}: {
  runId: string;
  status: RunStatus;
  /** Refetch run status after cancel succeeds or run already finished (409). */
  onCancelSettled?: () => void;
  exportInput?: TranscriptInput | null;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canStop = status === "running" || status === "created" || status === "connecting";
  const isTerminal = status === "completed" || status === "failed" || status === "cancelled";

  const cancelMutation = useMutation({
    mutationFn: () => cancelRun(runId),
    onSuccess: () => {
      setConfirmOpen(false);
      onCancelSettled?.();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          toast.info("This run already finished.");
          setConfirmOpen(false);
          onCancelSettled?.();
          return;
        }
        const detail = parseApiDetail(error.body);
        toast.error(detail ?? "Could not cancel the run.");
        return;
      }
      toast.error("Could not cancel the run. Check your connection.");
    },
  });

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied — share the review.");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  const copyTranscript = async () => {
    if (!exportInput || !canExportTranscript(exportInput)) {
      toast.error("Nothing to export yet — wait for at least one judge decision.");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildTranscriptMarkdown(exportInput));
      toast.success("Transcript copied to clipboard.");
    } catch {
      toast.error("Could not copy the transcript.");
    }
  };

  const downloadTranscript = () => {
    if (!exportInput || !canExportTranscript(exportInput)) {
      toast.error("Nothing to export yet — wait for at least one judge decision.");
      return;
    }
    const markdown = buildTranscriptMarkdown(exportInput);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = transcriptFilename(exportInput.idea, runId);
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded.");
  };

  const exportReady = canExportTranscript(exportInput ?? null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {canStop && (
        <>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setConfirmOpen(true)}
            disabled={cancelMutation.isPending}
          >
            <OctagonX className="size-4" aria-hidden />
            Stop
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{RUN_PAGE_COPY.stopReviewTitle}</DialogTitle>
                <DialogDescription>{RUN_PAGE_COPY.stopReviewDescription}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                  Keep going
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  {cancelMutation.isPending ? "Stopping…" : "Stop the run"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {isTerminal && (
        <details className="relative">
          <summary
            className={cn(
              secondaryCtaClass,
              "list-none gap-2 [&::-webkit-details-marker]:hidden",
            )}
          >
            <MoreHorizontal className="size-4" aria-hidden />
            {RUN_PAGE_COPY.shareExportMenu}
          </summary>
          <div
            className="absolute left-0 z-10 mt-1 min-w-52 rounded-ui border border-rule-soft bg-card py-1 shadow-soft"
            role="group"
            aria-label="Share and export"
          >
            <button
              type="button"
              className="flex w-full min-h-11 items-center gap-2 px-4 py-2 font-sans text-sm text-ink hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cta"
              onClick={() => void share()}
            >
              <Share2 className="size-4" aria-hidden />
              Share link
            </button>
            {exportReady ? (
              <>
                <button
                  type="button"
                  className="flex w-full min-h-11 items-center gap-2 px-4 py-2 font-sans text-sm text-ink hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cta"
                  onClick={() => void copyTranscript()}
                >
                  <Copy className="size-4" aria-hidden />
                  Copy transcript
                </button>
                <button
                  type="button"
                  className="flex w-full min-h-11 items-center gap-2 px-4 py-2 font-sans text-sm text-ink hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cta"
                  onClick={downloadTranscript}
                >
                  <Download className="size-4" aria-hidden />
                  Download .md
                </button>
              </>
            ) : null}
            <Link
              href="/workspaces/new"
              className="flex w-full min-h-11 items-center px-4 py-2 font-sans text-sm text-ink hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cta"
            >
              {RUN_PAGE_COPY.submitAnother}
            </Link>
          </div>
        </details>
      )}
    </div>
  );
}
