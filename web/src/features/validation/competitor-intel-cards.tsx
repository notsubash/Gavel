import type { CompetitorIntelItem } from "@/lib/api/workspaces";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { cn } from "@/lib/utils";

function signalBadgeVariant(
  strength: CompetitorIntelItem["signal_strength"],
): "pass" | "conditional" | "default" {
  if (strength === "strong") return "pass";
  if (strength === "weak") return "conditional";
  return "default";
}

type CompetitorIntelCardsProps = {
  title?: string;
  rows: CompetitorIntelItem[];
  overallGap?: string;
  className?: string;
  compact?: boolean;
};

export function CompetitorIntelCards({
  title,
  rows,
  overallGap,
  className,
  compact = false,
}: CompetitorIntelCardsProps) {
  if (!rows.length) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {title ? (
        <p className="font-sans text-sm font-semibold text-ink">{title}</p>
      ) : null}
      <ul className={cn("space-y-3", compact && "space-y-2")}>
        {rows.map((row) => (
          <li key={row.competitor}>
            <Card
              className={cn(
                "space-y-2 border border-rule-soft bg-paper-2",
                compact ? "p-3" : "p-4",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-sans text-sm font-semibold text-ink">{row.competitor}</h3>
                <Badge variant={signalBadgeVariant(row.signal_strength)}>
                  {row.signal_strength}
                </Badge>
              </div>
              <p className="font-sans text-sm leading-relaxed text-ink">{row.positioning}</p>
              {row.gap_vs_us ? (
                <p className="font-sans text-sm leading-relaxed text-ink-muted">
                  <span className="font-medium text-ink">Gap vs us:</span> {row.gap_vs_us}
                </p>
              ) : null}
              {row.source_url ? (
                <a
                  href={row.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block font-sans text-sm font-medium text-cta hover:underline"
                >
                  {row.source_title ?? row.source_url}
                </a>
              ) : (
                <p className="font-sans text-xs text-ink-muted">No source matched — verify manually.</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {overallGap ? (
        <Card className="space-y-1 border border-cta/25 bg-cta/5 p-4">
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-cta">
            Overall gap
          </p>
          <p className="font-sans text-sm leading-relaxed text-ink">{overallGap}</p>
        </Card>
      ) : null}
    </div>
  );
}
