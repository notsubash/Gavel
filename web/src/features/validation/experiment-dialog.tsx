"use client";

import { Loader2 } from "lucide-react";

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

export function ExperimentDialog({
  open,
  onOpenChange,
  mutations,
  experimentDraft,
  onDraftChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: ValidationMutations;
  experimentDraft: Partial<Experiment> | null;
  onDraftChange: (draft: Partial<Experiment>) => void;
  onReset: () => void;
}) {
  const { saveExperimentMutation } = mutations;

  if (!experimentDraft) return null;

  const handleClose = (next: boolean) => {
    if (!next) onReset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Experiment draft</DialogTitle>
            <Badge variant="heat">AI draft</Badge>
          </div>
          <DialogDescription>Review and edit before creating the experiment.</DialogDescription>
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
          />
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

        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            onClick={() =>
              saveExperimentMutation.mutate(experimentDraft, {
                onSuccess: () => handleClose(false),
              })
            }
            disabled={saveExperimentMutation.isPending}
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
