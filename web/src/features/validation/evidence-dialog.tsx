"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  EVIDENCE_TYPE_LABEL,
  parseCompetitorEvidenceContent,
} from "@/features/validation/competitor-evidence";
import { CompetitorIntelCards } from "@/features/validation/competitor-intel-cards";
import type { CompetitorIntelItem } from "@/lib/api/workspaces";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { Label } from "@/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Textarea } from "@/ui/textarea";

import type { ValidationMutations } from "./use-validation-mutations";

const EVIDENCE_TYPES = Object.entries(EVIDENCE_TYPE_LABEL);

export function EvidenceDialog({
  open,
  onOpenChange,
  mutations,
  evidenceType,
  evidenceContent,
  mappedAssumptionIds,
  mapRationale,
  competitorIntel,
  competitorScanResult,
  competitorFindings,
  evidenceEditOpen,
  onEvidenceTypeChange,
  onEvidenceContentChange,
  onEvidenceEditToggle,
  onMapSuccess,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: ValidationMutations;
  evidenceType: string;
  evidenceContent: string;
  mappedAssumptionIds: string[];
  mapRationale: string | null;
  competitorIntel: CompetitorIntelItem[];
  competitorScanResult: string | null;
  competitorFindings: Array<{ title: string; url: string; snippet: string }>;
  evidenceEditOpen: boolean;
  onEvidenceTypeChange: (value: string) => void;
  onEvidenceContentChange: (value: string) => void;
  onEvidenceEditToggle: () => void;
  onMapSuccess: (res: { suggested_assumption_ids: string[]; rationale: string | null }) => void;
  onReset: () => void;
}) {
  const { mapEvidenceMutation, saveEvidenceMutation } = mutations;

  const handleClose = (next: boolean) => {
    if (!next) onReset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add evidence</DialogTitle>
          <DialogDescription>
            Log quotes, metrics, or research and link them to assumptions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="evidence-type">Type</Label>
          <Select value={evidenceType} onValueChange={onEvidenceTypeChange}>
            <SelectTrigger id="evidence-type" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVIDENCE_TYPES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {competitorIntel.length > 0 ? (
          <CompetitorIntelCards
            title={`Competitor scan — ${competitorIntel.length} row(s)`}
            rows={competitorIntel}
            overallGap={parseCompetitorEvidenceContent(evidenceContent)?.overallGap}
          />
        ) : null}

        {competitorScanResult ? (
          <p className="font-sans text-xs text-ink-muted">
            Competitor research draft for Case evidence — Pitch keeps the short alternatives list.
            Confirm links and strength before saving.
          </p>
        ) : null}

        {competitorFindings.length > 0 ? (
          <details className="rounded-ui border border-rule-soft bg-paper-2 p-4">
            <summary className="cursor-pointer font-sans text-sm font-medium text-ink">
              All sources ({competitorFindings.length})
            </summary>
            <ul className="mt-3 space-y-2 font-sans text-sm">
              {competitorFindings.map((f) => (
                <li key={f.url}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-cta hover:underline"
                  >
                    {f.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="space-y-2">
          {competitorIntel.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0 text-cta hover:bg-transparent hover:text-cta/80"
              onClick={onEvidenceEditToggle}
            >
              {evidenceEditOpen ? "Hide raw text" : "Edit raw text"}
            </Button>
          ) : (
            <Label htmlFor="evidence-content">Content</Label>
          )}
          {(!competitorIntel.length || evidenceEditOpen) && (
            <Textarea
              id="evidence-content"
              rows={competitorIntel.length ? 8 : 4}
              value={evidenceContent}
              onChange={(e) => onEvidenceContentChange(e.target.value)}
            />
          )}
        </div>

        {mappedAssumptionIds.length > 0 && (
          <p className="font-sans text-sm text-ink-muted">
            Suggested links: {mappedAssumptionIds.length} assumption(s)
            {mapRationale ? ` — ${mapRationale}` : ""}
          </p>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              mapEvidenceMutation.mutate(
                { content: evidenceContent, type: evidenceType },
                {
                  onSuccess: (res) => {
                    onMapSuccess(res);
                    toast.message(
                      res.suggested_assumption_ids.length
                        ? `Linked to ${res.suggested_assumption_ids.length} assumption(s)`
                        : "No assumption links suggested",
                    );
                  },
                },
              )
            }
            disabled={evidenceContent.length < 10 || mapEvidenceMutation.isPending}
          >
            {mapEvidenceMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            Suggest assumption links
          </Button>
          <Button
            type="button"
            onClick={() =>
              saveEvidenceMutation.mutate(
                {
                  type: evidenceType,
                  content: evidenceContent,
                  strength: evidenceType === "ai_research" ? "weak" : "moderate",
                  source: null,
                  occurred_at: null,
                  assumption_ids: mappedAssumptionIds,
                  experiment_id: null,
                },
                { onSuccess: () => handleClose(false) },
              )
            }
            disabled={evidenceContent.length < 1 || saveEvidenceMutation.isPending}
          >
            {saveEvidenceMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            Save evidence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
