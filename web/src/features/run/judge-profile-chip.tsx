import { JUDGE_META } from "@/lib/sse/judges";
import { judgeStanceLabel, STANCE_CLASS } from "@/lib/sse/judge-stance";
import type { JudgeId, VerdictLabel } from "@/lib/sse/types";
import { cn } from "@/lib/utils";

export { judgeStanceLabel } from "@/lib/sse/judge-stance";

export function JudgeProfileChip({
  judgeId,
  verdict,
  showStance = true,
  showRole = false,
  className,
}: {
  judgeId: JudgeId;
  verdict?: VerdictLabel;
  /** Hide stance until a real verdict exists (loading/failed). */
  showStance?: boolean;
  /** Show role prose under the chip row. */
  showRole?: boolean;
  className?: string;
}) {
  const meta = JUDGE_META[judgeId];

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 border px-2 py-0.5 font-sans text-xs font-semibold",
            meta.accentClass,
          )}
        >
          <span>{meta.name}</span>
          <span className="text-ink-subtle" aria-hidden>
            ·
          </span>
          <span className="font-normal text-ink-muted">{meta.lensTag}</span>
        </span>
        {showStance && verdict && (
          <span
            className={cn(
              "inline-block border px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide",
              STANCE_CLASS[verdict],
            )}
          >
            {judgeStanceLabel(verdict)}
          </span>
        )}
      </div>
      {showRole && (
        <p className="font-sans text-xs leading-snug text-ink-muted">{meta.role}</p>
      )}
    </div>
  );
}
