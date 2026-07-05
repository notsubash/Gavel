"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import type { Experiment } from "@/lib/api/workspaces";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Label } from "@/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Textarea } from "@/ui/textarea";

import {
  EXPERIMENT_DECISION_LABEL,
  EXPERIMENT_STATUS_LABEL,
} from "./validation-labels";
import type { ValidationMutations } from "./use-validation-mutations";

function ExperimentCompleteForm({
  experimentId,
  result,
  decision,
  onResultChange,
  onDecisionChange,
  onSave,
  onCancel,
  pending,
}: {
  experimentId: string;
  result: string;
  decision: string;
  onResultChange: (value: string) => void;
  onDecisionChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div className="mt-4 space-y-3 border-t border-rule-soft pt-4">
      <div className="space-y-2">
        <Label htmlFor={`result-${experimentId}`}>Result</Label>
        <Textarea
          id={`result-${experimentId}`}
          rows={2}
          value={result}
          onChange={(e) => onResultChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`decision-${experimentId}`}>Decision</Label>
        <Select value={decision} onValueChange={onDecisionChange}>
          <SelectTrigger id={`decision-${experimentId}`} className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(EXPERIMENT_DECISION_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onSave} disabled={pending}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          Save decision
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ExperimentsList({
  workspaceId,
  experiments,
  mutations,
  completingExperimentId,
  experimentResult,
  experimentDecision,
  revisePromptExperimentId,
  onStartComplete,
  onCancelComplete,
  onResultChange,
  onDecisionChange,
  onDismissRevisePrompt,
  onExperimentCompleted,
}: {
  workspaceId: string;
  experiments: Experiment[];
  mutations: ValidationMutations;
  completingExperimentId: string | null;
  experimentResult: string;
  experimentDecision: string;
  revisePromptExperimentId: string | null;
  onStartComplete: (id: string) => void;
  onCancelComplete: () => void;
  onResultChange: (value: string) => void;
  onDecisionChange: (value: string) => void;
  onDismissRevisePrompt: () => void;
  onExperimentCompleted: (decision: string, id: string) => void;
}) {
  const { experimentStatusMutation } = mutations;
  const pendingId = experimentStatusMutation.isPending
    ? (experimentStatusMutation.variables?.id ?? null)
    : null;

  return (
    <section aria-labelledby="experiments-heading">
      <h2 id="experiments-heading" className="font-sans text-section font-semibold text-ink">
        Experiments
      </h2>
      {revisePromptExperimentId && (
        <Card className="mb-4 border-cta/30 p-4">
          <p className="font-sans text-body text-ink">
            This experiment suggests revising your worksheet. Apply evidence-backed field updates
            before your next judge review.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link
                href={`/workspaces/${workspaceId}/worksheet?revise=1&revise_experiment=${revisePromptExperimentId}`}
              >
                Revise from evidence
              </Link>
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDismissRevisePrompt}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}
      <ul className="mt-3 space-y-3">
        {experiments.map((experiment) => (
          <li key={experiment.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-sans text-body font-medium text-ink">{experiment.title}</p>
                  <p className="mt-1 font-sans text-sm text-ink-muted">{experiment.hypothesis}</p>
                  {experiment.pass_fail_threshold && (
                    <p className="mt-2 font-sans text-xs text-ink-subtle">
                      Threshold: {experiment.pass_fail_threshold}
                    </p>
                  )}
                </div>
                <Badge variant="default">
                  {EXPERIMENT_STATUS_LABEL[experiment.status] ?? experiment.status}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {experiment.status === "planned" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pendingId === experiment.id}
                    onClick={() =>
                      experimentStatusMutation.mutate({ id: experiment.id, status: "active" })
                    }
                  >
                    {pendingId === experiment.id && (
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    )}
                    Start
                  </Button>
                )}
                {experiment.status === "active" && completingExperimentId !== experiment.id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onStartComplete(experiment.id)}
                  >
                    Complete
                  </Button>
                )}
              </div>
              {completingExperimentId === experiment.id && (
                <ExperimentCompleteForm
                  experimentId={experiment.id}
                  result={experimentResult}
                  decision={experimentDecision}
                  onResultChange={onResultChange}
                  onDecisionChange={onDecisionChange}
                  onSave={() =>
                    experimentStatusMutation.mutate(
                      {
                        id: experiment.id,
                        status: "completed",
                        result: experimentResult,
                        decision: experimentDecision,
                      },
                      {
                        onSuccess: () =>
                          onExperimentCompleted(experimentDecision, experiment.id),
                      },
                    )
                  }
                  onCancel={onCancelComplete}
                  pending={pendingId === experiment.id}
                />
              )}
            </Card>
          </li>
        ))}
        {experiments.length === 0 && (
          <p className="font-sans text-body text-ink-muted">No experiments yet.</p>
        )}
      </ul>
    </section>
  );
}
