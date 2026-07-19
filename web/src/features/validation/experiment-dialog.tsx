"use client";

import { Loader2, Sparkles } from "lucide-react";

import type { Experiment } from "@/lib/api/workspaces";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";

import type { ValidationMutations } from "./use-validation-mutations";

const EMPTY_DRAFT: Partial<Experiment> = {
  title: "",
  hypothesis: "",
  pass_fail_threshold: "",
};

export function ExperimentDialog({
  open,
  onOpenChange,
  mutations,
  experimentDraft,
  onDraftChange,
  onReset,
  aiAssisted = false,
  onAiAssistedChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: ValidationMutations;
  experimentDraft: Partial<Experiment> | null;
  onDraftChange: (draft: Partial<Experiment>) => void;
  onReset: () => void;
  aiAssisted?: boolean;
  onAiAssistedChange?: (value: boolean) => void;
}) {
  const { saveExperimentMutation, suggestExperimentMutation } = mutations;

  if (!experimentDraft) return null;

  const title = (experimentDraft.title ?? "").trim();
  const hypothesis = (experimentDraft.hypothesis ?? "").trim();
  const canCreate = title.length > 0 && hypothesis.length >= 10;

  const handleClose = (next: boolean) => {
    if (!next) onReset();
    onOpenChange(next);
  };

  const runSuggest = () =>
    suggestExperimentMutation.mutate(undefined, {
      onSuccess: (res) => {
        onDraftChange(res.experiment);
        onAiAssistedChange?.(true);
      },
    });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>New experiment</DialogTitle>
            {aiAssisted ? <Badge variant="heat">AI draft</Badge> : null}
          </div>
          <DialogDescription>
            {aiAssisted
              ? "Review and edit before creating the experiment."
              : "Sketch the experiment, or ask AI for a draft once you are ready."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="exp-title">Title</Label>
          <Input
            id="exp-title"
            value={experimentDraft.title ?? ""}
            onChange={(e) => onDraftChange({ ...experimentDraft, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-hypothesis">Hypothesis</Label>
          <Textarea
            id="exp-hypothesis"
            rows={2}
            value={experimentDraft.hypothesis ?? ""}
            onChange={(e) => onDraftChange({ ...experimentDraft, hypothesis: e.target.value })}
            aria-invalid={hypothesis.length > 0 && hypothesis.length < 10 ? true : undefined}
          />
          {hypothesis.length > 0 && hypothesis.length < 10 ? (
            <p className="font-sans text-sm text-fail" role="alert">
              At least 10 characters
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-threshold">Pass / fail threshold</Label>
          <Textarea
            id="exp-threshold"
            rows={2}
            value={experimentDraft.pass_fail_threshold ?? ""}
            onChange={(e) =>
              onDraftChange({ ...experimentDraft, pass_fail_threshold: e.target.value })
            }
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={runSuggest}
            disabled={suggestExperimentMutation.isPending}
          >
            {suggestExperimentMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="mr-2 size-4 text-ai-processing" aria-hidden />
            )}
            Suggest experiment
          </Button>
          <Button
            type="button"
            onClick={() =>
              saveExperimentMutation.mutate(experimentDraft, {
                onSuccess: () => handleClose(false),
              })
            }
            disabled={!canCreate || saveExperimentMutation.isPending}
          >
            {saveExperimentMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            Create experiment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { EMPTY_DRAFT as EMPTY_EXPERIMENT_DRAFT };
