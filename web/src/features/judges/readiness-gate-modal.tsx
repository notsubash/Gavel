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

const LEVEL_LABEL: Record<string, string> = {
  too_vague: "Too vague",
  speculative: "Speculative",
  ready: "Ready for judges",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readiness: ReadinessResponse | null;
  briefing: string | null;
  briefingLoading: boolean;
  onFetchBriefing: () => void;
  onLaunch: (override: boolean) => void;
  launching: boolean;
};

export function ReadinessGateModal({
  open,
  onOpenChange,
  readiness,
  briefing,
  briefingLoading,
  onFetchBriefing,
  onLaunch,
  launching,
}: Props) {
  const [overrideAck, setOverrideAck] = useState(false);

  const blocked = readiness != null && !readiness.can_run_judges;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Readiness gate</DialogTitle>
          <DialogDescription>
            Judges roast the evidence-backed worksheet. The verdict below is rule-based; AI only
            explains it.
          </DialogDescription>
        </DialogHeader>

        {readiness ? (
          <div className="space-y-4">
            <p className="font-sans text-sm font-semibold text-ink">
              Status: {LEVEL_LABEL[readiness.level] ?? readiness.level}
            </p>
            <ul className="space-y-1 font-sans text-sm text-ink-muted">
              {readiness.checks.map((check) => (
                <li key={check.name}>
                  {check.passed ? "✓" : "✗"} {check.detail ?? check.name}
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

        {blocked ? (
          <label className="flex items-start gap-2 font-sans text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={overrideAck}
              onChange={(event) => setOverrideAck(event.target.checked)}
              className="mt-1"
            />
            Run judges anyway (override readiness gate)
          </label>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={launching || (blocked && !overrideAck)}
            onClick={() => onLaunch(blocked && overrideAck)}
          >
            {launching ? <Loader2 className="size-4 animate-spin" /> : null}
            Launch roast
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
