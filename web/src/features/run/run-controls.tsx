"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Download, OctagonX, Share2 } from "lucide-react";

import {
  buildTranscriptMarkdown,
  transcriptFilename,
  type TranscriptInput,
} from "@/lib/format/transcript-md";
import { ApiError } from "@/lib/api/client";
import { cancelRun } from "@/lib/api/runs";
import { parseApiDetail } from "@/lib/api/types-helpers";
import { RUN_PAGE_COPY } from "@/features/run/run-page-copy";
import { JUDGE_ORDER } from "@/lib/sse/types";
import type { RunStatus } from "@/lib/sse/types";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { MoreMenu, MoreMenuItem } from "@/ui/more-menu";

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
        <MoreMenu label={RUN_PAGE_COPY.shareExportMenu}>
          <MoreMenuItem onClick={() => void share()}>
            <Share2 className="size-4" aria-hidden />
            Share link
          </MoreMenuItem>
          {exportReady ? (
            <>
              <MoreMenuItem onClick={() => void copyTranscript()}>
                <Copy className="size-4" aria-hidden />
                Copy transcript
              </MoreMenuItem>
              <MoreMenuItem onClick={downloadTranscript}>
                <Download className="size-4" aria-hidden />
                Download .md
              </MoreMenuItem>
            </>
          ) : null}
          <MoreMenuItem href="/workspaces/new">{RUN_PAGE_COPY.submitAnother}</MoreMenuItem>
        </MoreMenu>
      )}
    </div>
  );
}
