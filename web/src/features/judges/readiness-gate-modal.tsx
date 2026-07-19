"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import type { ReadinessResponse } from "@/lib/api/workspaces";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { Skeleton } from "@/ui/skeleton";

const LEVEL_LABEL: Record<string, string> = {
  too_vague: "Too vague",
  speculative: "Speculative",
  ready: "Ready for judges",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readiness: ReadinessResponse | null;
  readinessLoading: boolean;
  readinessError: boolean;
  onRetryReadiness: () => void;
  briefing: string | null;
  briefingLoading: boolean;
  onFetchBriefing: () => void;
  onLaunch: (override: boolean) => void;
  launching: boolean;
};

function checkAriaLabel(check: ReadinessResponse["checks"][number]): string {
  const detail = check.detail ?? check.name;
  return check.passed ? `Passed: ${detail}` : `Failed: ${detail}`;
}

export function ReadinessGateModal({
  open,
  onOpenChange,
  readiness,
  readinessLoading,
  readinessError,
  onRetryReadiness,
  briefing,
  briefingLoading,
  onFetchBriefing,
  onLaunch,
  launching,
}: Props) {
  const [overrideAck, setOverrideAck] = useState(false);

  const blocked = readiness != null && !readiness.can_run_judges;
  const needsOverride = blocked || readinessError;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setOverrideAck(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Readiness gate</DialogTitle>
          <DialogDescription>
            Judges review the evidence-backed worksheet. The verdict below is rule-based; AI only
            explains it.
          </DialogDescription>
        </DialogHeader>

        {readinessLoading ? (
          <div
            className="space-y-3"
            aria-busy="true"
            aria-label="Loading readiness checks"
          >
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : readinessError ? (
          <div className="space-y-3" role="alert">
            <p className="font-sans text-sm text-fail">Could not load readiness checks.</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetryReadiness}>
              Try again
            </Button>
          </div>
        ) : readiness ? (
          <div className="space-y-4">
            <p className="font-sans text-sm font-semibold text-ink">
              Status: {LEVEL_LABEL[readiness.level] ?? readiness.level}
            </p>
            <ul className="space-y-1 font-sans text-sm text-ink-muted">
              {readiness.checks.map((check) => (
                <li key={check.name} aria-label={checkAriaLabel(check)}>
                  <span aria-hidden>{check.passed ? "✓" : "✗"}</span>{" "}
                  {check.detail ?? check.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {briefing ? (
          <p className="whitespace-pre-wrap font-sans text-sm text-ink-muted">{briefing}</p>
        ) : (
          <Button type="button" variant="secondary" disabled={briefingLoading} onClick={onFetchBriefing}>
            {briefingLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Explain readiness
          </Button>
        )}

        {needsOverride ? (
          <label className="flex items-start gap-2 font-sans text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={overrideAck}
              onChange={(event) => setOverrideAck(event.target.checked)}
              className="mt-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
            />
            {readinessError
              ? "Launch without readiness check"
              : "Run judges anyway (override readiness gate)"}
          </label>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              launching ||
              readinessLoading ||
              (!readiness && !readinessError) ||
              (needsOverride && !overrideAck)
            }
            onClick={() => onLaunch(needsOverride && overrideAck)}
          >
            {launching ? <Loader2 className="size-4 animate-spin" /> : null}
            Start review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
