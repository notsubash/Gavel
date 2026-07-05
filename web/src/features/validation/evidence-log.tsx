"use client";

import type { Evidence } from "@/lib/api/workspaces";
import {
  EVIDENCE_STRENGTH_LABEL,
  EVIDENCE_TYPE_LABEL,
  isCompetitorEvidenceType,
  parseCompetitorEvidenceContent,
} from "@/features/validation/competitor-evidence";
import { CompetitorIntelCards } from "@/features/validation/competitor-intel-cards";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";

export function EvidenceLog({ evidence }: { evidence: Evidence[] }) {
  return (
    <section aria-labelledby="evidence-heading">
      <h2 id="evidence-heading" className="font-sans text-section font-semibold text-ink">
        Evidence log
      </h2>
      <ul className="mt-3 space-y-2">
        {evidence.map((item) => {
          const parsedCompetitor = isCompetitorEvidenceType(item.type)
            ? parseCompetitorEvidenceContent(item.content)
            : null;

          return (
            <li key={item.id}>
              <Card className="p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">
                    Type: {EVIDENCE_TYPE_LABEL[item.type] ?? item.type.replaceAll("_", " ")}
                  </Badge>
                  <Badge variant="default">
                    Strength: {EVIDENCE_STRENGTH_LABEL[item.strength] ?? item.strength}
                  </Badge>
                </div>
                {parsedCompetitor ? (
                  <div className="mt-3">
                    <CompetitorIntelCards
                      title={parsedCompetitor.title}
                      rows={parsedCompetitor.rows}
                      overallGap={parsedCompetitor.overallGap}
                      compact
                    />
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap font-sans text-body leading-relaxed text-ink">
                    {item.content}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
        {evidence.length === 0 && (
          <p className="font-sans text-body text-ink-muted">No evidence logged yet.</p>
        )}
      </ul>
    </section>
  );
}
