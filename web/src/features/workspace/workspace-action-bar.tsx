"use client";

import { Loader2, Download, Sparkles } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";

import { MoreMenu, MoreMenuItem } from "@/ui/more-menu";

type ExportMutation = Pick<UseMutationResult<void, Error, void, unknown>, "mutate" | "isPending">;
type WeeklyMutation = Pick<
  UseMutationResult<
    {
      summary: string;
      highlights: string[];
      open_questions: string[];
      evidence_count: number;
    },
    Error,
    void,
    unknown
  >,
  "mutate" | "isPending"
>;

type WorkspaceActionBarProps = {
  coachMutation: ExportMutation;
  exportMarkdownMutation: ExportMutation;
  exportBriefMutation: ExportMutation;
  /** Phase 2: weekly review only after evidence exists */
  weeklyMutation?: WeeklyMutation | null;
};

export function WorkspaceActionBar({
  coachMutation,
  exportMarkdownMutation,
  exportBriefMutation,
  weeklyMutation = null,
}: WorkspaceActionBarProps) {
  const busy =
    coachMutation.isPending ||
    exportMarkdownMutation.isPending ||
    exportBriefMutation.isPending ||
    Boolean(weeklyMutation?.isPending);

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={busy || undefined}>
      <MoreMenu label="More actions">
        <MoreMenuItem
          disabled={coachMutation.isPending}
          onClick={() => coachMutation.mutate()}
        >
          {coachMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4 text-ai-processing" aria-hidden />
          )}
          Coach
        </MoreMenuItem>
        {weeklyMutation ? (
          <MoreMenuItem
            disabled={weeklyMutation.isPending}
            onClick={() => weeklyMutation.mutate()}
          >
            {weeklyMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4 text-ai-processing" aria-hidden />
            )}
            Review week
          </MoreMenuItem>
        ) : null}
        <MoreMenuItem
          disabled={exportMarkdownMutation.isPending}
          onClick={() => exportMarkdownMutation.mutate()}
        >
          {exportMarkdownMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Export markdown
        </MoreMenuItem>
        <MoreMenuItem
          disabled={exportBriefMutation.isPending}
          onClick={() => exportBriefMutation.mutate()}
        >
          {exportBriefMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Judge brief
        </MoreMenuItem>
      </MoreMenu>
    </div>
  );
}
