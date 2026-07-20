"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createAssumption,
  createEvidence,
  createExperiment,
  validationDataQueryKey,
  validationOverviewQueryKey,
  type RunHandoffItem,
} from "@/lib/api/workspaces";
import { ApiError } from "@/lib/api/client";
import { parseApiDetail } from "@/lib/api/types-helpers";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

const KIND_LABEL: Record<RunHandoffItem["kind"], string> = {
  assumption: "Assumption",
  evidence_target: "Evidence ask",
  experiment: "Experiment",
};

function handoffAppliedKey(runId: string) {
  return `gavel-handoff-applied:${runId}`;
}

function readApplied(runId: string): boolean {
  try {
    return sessionStorage.getItem(handoffAppliedKey(runId)) === "1";
  } catch {
    return false;
  }
}

function writeApplied(runId: string) {
  try {
    sessionStorage.setItem(handoffAppliedKey(runId), "1");
  } catch {
    /* private mode — re-click may duplicate until refresh clears UI state */
  }
}

async function createHandoffItem(workspaceId: string, item: RunHandoffItem) {
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
}

/** Phase 2: one add-all CTA → Case validation (no per-item task UI). */
export function PostRoastHandoff({
  workspaceId,
  runId,
  items,
}: {
  workspaceId: string;
  runId: string;
  items: RunHandoffItem[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [applied, setApplied] = useState(() => readApplied(runId));
  const caseHref = `/workspaces/${workspaceId}/validation`;

  const mutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        items.map((item) => createHandoffItem(workspaceId, item)),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - ok;
      if (ok === 0) {
        const first = results.find((r) => r.status === "rejected");
        throw first && first.status === "rejected" ? first.reason : new Error("All handoff creates failed");
      }
      return { ok, failed };
    },
    onSuccess: async ({ ok, failed }) => {
      writeApplied(runId);
      setApplied(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: validationDataQueryKey(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: validationOverviewQueryKey(workspaceId) }),
      ]);
      if (failed > 0) {
        toast.error(`Added ${ok} of ${items.length} tasks — retry from Case if something is missing`);
      } else {
        toast.success(`Added ${ok} recommended task${ok === 1 ? "" : "s"}`);
      }
      router.push(caseHref);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? parseApiDetail(error.body) : "Could not save handoff items";
      toast.error(message ?? "Could not save handoff items");
    },
  });

  if (items.length === 0) return null;

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="font-sans text-body font-semibold text-ink">Recommended tasks from last review</h3>
        <p className="mt-1 font-sans text-sm text-ink-muted">
          {applied
            ? "These were already added to Case validation."
            : "Add these to Case validation in one step, then finish the work there."}
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={`${item.kind}-${index}`}
            className="border border-rule-soft px-4 py-3 font-sans text-sm text-ink"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">
              {KIND_LABEL[item.kind]}
            </p>
            <p className="mt-1">{item.title}</p>
          </li>
        ))}
      </ul>
      {applied ? (
        <Button type="button" asChild>
          <Link href={caseHref}>Continue on Case</Link>
        </Button>
      ) : (
        <Button
          type="button"
          disabled={mutation.isPending}
          aria-busy={mutation.isPending || undefined}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
          Add recommended tasks
        </Button>
      )}
    </Card>
  );
}
