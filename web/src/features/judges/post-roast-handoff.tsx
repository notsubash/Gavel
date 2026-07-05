"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createAssumption,
  createEvidence,
  createExperiment,
  type RunHandoffItem,
} from "@/lib/api/workspaces";
import { ApiError } from "@/lib/api/client";
import { parseApiDetail } from "@/lib/api/types-helpers";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

const KIND_LABEL: Record<RunHandoffItem["kind"], string> = {
  assumption: "Add as assumption",
  evidence_target: "Log evidence",
  experiment: "Start experiment",
};

export function PostRoastHandoff({
  workspaceId,
  items,
}: {
  workspaceId: string;
  items: RunHandoffItem[];
}) {
  const mutation = useMutation({
    mutationFn: async (item: RunHandoffItem) => {
      if (item.kind === "assumption") {
        return createAssumption(workspaceId, { statement: item.title });
      }
      if (item.kind === "evidence_target") {
        return createEvidence(workspaceId, {
          type: "founder_note",
          content: item.detail,
          strength: "weak",
          source: item.source_judge ? `Judge: ${item.source_judge}` : "Post-roast handoff",
          occurred_at: null,
          assumption_ids: [],
          experiment_id: null,
        });
      }
      return createExperiment(workspaceId, {
        title: item.title.slice(0, 120),
        hypothesis: item.detail,
        status: "planned",
        assumption_id: null,
        method: null,
        target: null,
        pass_fail_threshold: null,
        start_date: null,
        due_date: null,
      });
    },
    onSuccess: (_data, item) => {
      toast.success(`${KIND_LABEL[item.kind]} saved`);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? parseApiDetail(error.body) : "Could not save handoff item";
      toast.error(message ?? "Could not save handoff item");
    },
  });

  if (items.length === 0) return null;

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="font-serif text-lg text-ink">Turn judge feedback into validation tasks</h3>
        <p className="mt-1 font-sans text-sm text-ink-muted">
          One-click drafts from the last roast. Review before you treat them as truth.
        </p>
      </div>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li
            key={`${item.kind}-${index}`}
            className="flex flex-col gap-3 border border-rule-soft p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-subtle">
                {item.kind.replace("_", " ")}
              </p>
              <p className="mt-1 font-sans text-sm text-ink">{item.title}</p>
              {item.source_judge ? (
                <p className="mt-1 font-mono text-xs text-ink-subtle">from {item.source_judge}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(item)}
            >
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {KIND_LABEL[item.kind]}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
