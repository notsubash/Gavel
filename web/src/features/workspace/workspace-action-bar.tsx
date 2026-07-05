"use client";

import { Loader2, Download, MoreHorizontal, Sparkles } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";

import { cn } from "@/lib/utils";

type ExportMutation = Pick<UseMutationResult<void, Error, void, unknown>, "mutate" | "isPending">;

type WorkspaceActionBarProps = {
  coachMutation: ExportMutation;
  exportMarkdownMutation: ExportMutation;
  exportBriefMutation: ExportMutation;
};

export function WorkspaceActionBar({
  coachMutation,
  exportMarkdownMutation,
  exportBriefMutation,
}: WorkspaceActionBarProps) {
  const busy =
    coachMutation.isPending || exportMarkdownMutation.isPending || exportBriefMutation.isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <details className="relative">
        <summary
          className={cn(
            "inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-ui border border-rule-soft bg-card px-4",
            "font-sans text-sm font-semibold text-ink transition-colors duration-200",
            "hover:bg-paper-2 active:bg-paper",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta",
            "[&::-webkit-details-marker]:hidden",
          )}
          aria-busy={busy || undefined}
        >
          <MoreHorizontal className="size-4" aria-hidden />
          More actions
        </summary>
        <div
          className="absolute left-0 z-10 mt-1 min-w-48 rounded-ui border border-rule-soft bg-card py-1 shadow-soft"
          role="group"
          aria-label="More workspace actions"
        >
          <ActionMenuItem
            label="Coach"
            icon={<Sparkles className="size-4 text-ai-processing" aria-hidden />}
            pending={coachMutation.isPending}
            onClick={() => coachMutation.mutate()}
          />
          <ActionMenuItem
            label="Export markdown"
            icon={<Download className="size-4" aria-hidden />}
            pending={exportMarkdownMutation.isPending}
            onClick={() => exportMarkdownMutation.mutate()}
          />
          <ActionMenuItem
            label="Judge brief"
            icon={<Download className="size-4" aria-hidden />}
            pending={exportBriefMutation.isPending}
            onClick={() => exportBriefMutation.mutate()}
          />
        </div>
      </details>
    </div>
  );
}

function ActionMenuItem({
  label,
  icon,
  pending,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        "flex w-full min-h-11 items-center gap-2 px-4 py-2 font-sans text-sm text-ink",
        "hover:bg-paper-2 active:bg-paper disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cta",
      )}
      onClick={onClick}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {label}
    </button>
  );
}
