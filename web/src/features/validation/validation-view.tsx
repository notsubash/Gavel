"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  ASSUMPTION_COLUMNS,
  createEvidence,
  createExperiment,
  createInterview,
  getValidationOverview,
  listAssumptions,
  listEvidence,
  listExperiments,
  listInterviews,
  mapEvidence,
  suggestExperiment,
  suggestInterviewQuestions,
  summarizeInterview,
  updateAssumption,
  updateExperiment,
  validationDataQueryKey,
  validationOverviewQueryKey,
  workspaceQueryKey,
  type Assumption,
  type AssumptionStatus,
  type Experiment,
} from "@/lib/api/workspaces";
import { ApiError } from "@/lib/api/client";
import { parseApiDetail } from "@/lib/api/types-helpers";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Skeleton } from "@/ui/skeleton";
import { Textarea } from "@/ui/textarea";

const COLUMN_LABEL: Record<AssumptionStatus, string> = {
  untested: "Untested",
  testing: "Testing",
  supported: "Supported",
  contradicted: "Contradicted",
  retired: "Retired",
};

async function fetchValidationBundle(workspaceId: string) {
  const [assumptions, experiments, evidence, interviews] = await Promise.all([
    listAssumptions(workspaceId),
    listExperiments(workspaceId),
    listEvidence(workspaceId),
    listInterviews(workspaceId),
  ]);
  return { assumptions, experiments, evidence, interviews };
}

export function ValidationView({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: validationDataQueryKey(workspaceId),
    queryFn: () => fetchValidationBundle(workspaceId),
  });

  const overviewQuery = useQuery({
    queryKey: validationOverviewQueryKey(workspaceId),
    queryFn: () => getValidationOverview(workspaceId),
  });

  const [interviewOpen, setInterviewOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [questions, setQuestions] = useState<{ question: string; rationale: string }[]>([]);

  const [personLabel, setPersonLabel] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [extractedQuotes, setExtractedQuotes] = useState<string[]>([]);
  const [suggestedAssumptionIds, setSuggestedAssumptionIds] = useState<string[]>([]);

  const [evidenceContent, setEvidenceContent] = useState("");
  const [evidenceType, setEvidenceType] = useState("interview_quote");
  const [mappedAssumptionIds, setMappedAssumptionIds] = useState<string[]>([]);
  const [mapRationale, setMapRationale] = useState<string | null>(null);

  const [experimentDraft, setExperimentDraft] = useState<Partial<Experiment> | null>(null);
  const [completingExperimentId, setCompletingExperimentId] = useState<string | null>(null);
  const [experimentResult, setExperimentResult] = useState("");
  const [experimentDecision, setExperimentDecision] = useState("continue");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: validationDataQueryKey(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: validationOverviewQueryKey(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
  };

  const questionsMutation = useMutation({
    mutationFn: () => suggestInterviewQuestions(workspaceId),
    onSuccess: (res) => {
      setQuestions(res.questions);
      setInterviewOpen(true);
      toast.success("Interview questions ready");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Could not suggest questions");
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: () =>
      summarizeInterview(workspaceId, {
        notes: interviewNotes,
        person_label: personLabel || undefined,
      }),
    onSuccess: (res) => {
      setAiSummary(res.summary);
      setExtractedQuotes(res.extracted_quotes);
      setSuggestedAssumptionIds(res.suggested_assumption_ids);
      if (res.extracted_quotes.length) {
        toast.message(`${res.extracted_quotes.length} quote(s) extracted`);
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Summarize failed");
    },
  });

  const saveInterviewMutation = useMutation({
    mutationFn: () =>
      createInterview(workspaceId, {
        person_label: personLabel,
        notes: interviewNotes,
        quotes: extractedQuotes,
        assumption_ids: suggestedAssumptionIds,
        segment: null,
        occurred_at: null,
        context: null,
        workaround: null,
        pain_cost: null,
        objections: null,
        ai_summary: aiSummary,
      }),
    onSuccess: () => {
      toast.success("Interview saved");
      setInterviewOpen(false);
      setPersonLabel("");
      setInterviewNotes("");
      setAiSummary(null);
      setExtractedQuotes([]);
      setSuggestedAssumptionIds([]);
      setQuestions([]);
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Could not save interview");
    },
  });

  const mapEvidenceMutation = useMutation({
    mutationFn: () =>
      mapEvidence(workspaceId, { content: evidenceContent, type: evidenceType }),
    onSuccess: (res) => {
      setMappedAssumptionIds(res.suggested_assumption_ids);
      setMapRationale(res.rationale);
      toast.message(
        res.suggested_assumption_ids.length
          ? `Linked to ${res.suggested_assumption_ids.length} assumption(s)`
          : "No assumption links suggested",
      );
    },
  });

  const saveEvidenceMutation = useMutation({
    mutationFn: () =>
      createEvidence(workspaceId, {
        type: evidenceType,
        content: evidenceContent,
        strength: "weak",
        source: null,
        occurred_at: null,
        assumption_ids: mappedAssumptionIds,
        experiment_id: null,
      }),
    onSuccess: () => {
      toast.success("Evidence logged");
      setEvidenceOpen(false);
      setEvidenceContent("");
      setMappedAssumptionIds([]);
      setMapRationale(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Could not save evidence");
    },
  });

  const suggestExperimentMutation = useMutation({
    mutationFn: () => suggestExperiment(workspaceId),
    onSuccess: (res) => {
      setExperimentDraft(res.experiment);
      setExperimentOpen(true);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Suggest failed");
    },
  });

  const saveExperimentMutation = useMutation({
    mutationFn: () => {
      if (!experimentDraft?.title || !experimentDraft.hypothesis) {
        throw new Error("Title and hypothesis required");
      }
      return createExperiment(workspaceId, {
        title: experimentDraft.title,
        hypothesis: experimentDraft.hypothesis,
        assumption_id: experimentDraft.assumption_id ?? null,
        method: experimentDraft.method ?? null,
        target: experimentDraft.target ?? null,
        pass_fail_threshold: experimentDraft.pass_fail_threshold ?? null,
        start_date: experimentDraft.start_date ?? null,
        due_date: experimentDraft.due_date ?? null,
        status: experimentDraft.status ?? "planned",
      });
    },
    onSuccess: () => {
      toast.success("Experiment created");
      setExperimentOpen(false);
      setExperimentDraft(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Could not create experiment");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AssumptionStatus }) =>
      updateAssumption(workspaceId, id, { status }),
    onSuccess: invalidate,
  });

  const experimentStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      result,
      decision,
    }: {
      id: string;
      status: Experiment["status"];
      result?: string;
      decision?: string;
    }) => updateExperiment(workspaceId, id, { status, result, decision }),
    onSuccess: () => {
      setCompletingExperimentId(null);
      setExperimentResult("");
      setExperimentDecision("continue");
      invalidate();
    },
  });

  const byColumn = useMemo(() => {
    const map: Record<AssumptionStatus, Assumption[]> = {
      untested: [],
      testing: [],
      supported: [],
      contradicted: [],
      retired: [],
    };
    for (const a of data?.assumptions ?? []) {
      map[a.status]?.push(a);
    }
    return map;
  }, [data?.assumptions]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="font-sans text-body text-fail" role="alert">
        Could not load validation data.
      </p>
    );
  }

  const { assumptions, experiments, evidence, interviews } = data;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
            Validation
          </h1>
          <p className="mt-2 max-w-prose font-sans text-body text-ink-muted">
            Collect evidence, test assumptions, and decide what to learn next before judges.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/workspaces/${workspaceId}`}>Overview</Link>
        </Button>
      </header>

      {overviewQuery.data && (
        <section aria-labelledby="checklist-heading">
          <h2 id="checklist-heading" className="font-sans text-section font-semibold text-ink">
            Validation progress
          </h2>
          <Card className="mt-3 space-y-4 p-5">
            <p className="font-sans text-body text-ink">
              {overviewQuery.data.checklist.next_action}
            </p>
            <div className="flex flex-wrap gap-2">
              {overviewQuery.data.checklist.items.map((item) => (
                <Badge
                  key={item.stage}
                  variant={item.completed ? "pass" : "default"}
                  title={item.label}
                >
                  {item.completed ? "✓" : "○"} {item.stage.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </Card>
        </section>
      )}

      <section aria-labelledby="actions-heading" className="flex flex-wrap gap-3">
        <h2 id="actions-heading" className="sr-only">
          Validation actions
        </h2>
        <Button
          type="button"
          variant="outline"
          onClick={() => questionsMutation.mutate()}
          disabled={questionsMutation.isPending}
        >
          {questionsMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="mr-2 size-4" aria-hidden />
          )}
          Suggest interview questions
        </Button>
        <Button type="button" variant="outline" onClick={() => setInterviewOpen(true)}>
          Log interview
        </Button>
        <Button type="button" variant="outline" onClick={() => setEvidenceOpen(true)}>
          Add evidence
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => suggestExperimentMutation.mutate()}
          disabled={suggestExperimentMutation.isPending}
        >
          {suggestExperimentMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="mr-2 size-4" aria-hidden />
          )}
          Suggest experiment
        </Button>
      </section>

      {interviewOpen && (
        <Card className="space-y-4 p-5">
          <h2 className="font-sans text-section font-semibold text-ink">Interview note</h2>
          {questions.length > 0 && (
            <div className="rounded-ui border border-rule-soft bg-paper-2 p-4">
              <p className="font-sans text-meta font-semibold uppercase tracking-wide text-ink-subtle">
                Suggested questions
              </p>
              <ul className="mt-2 space-y-2 font-sans text-sm text-ink">
                {questions.map((q) => (
                  <li key={q.question}>
                    <span className="font-medium">{q.question}</span>
                    <span className="block text-ink-muted">{q.rationale}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="person-label">Person</Label>
            <Input
              id="person-label"
              value={personLabel}
              onChange={(e) => setPersonLabel(e.target.value)}
              placeholder="e.g. Solo SaaS founder, design partner"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interview-notes">Notes</Label>
            <Textarea
              id="interview-notes"
              rows={6}
              value={interviewNotes}
              onChange={(e) => setInterviewNotes(e.target.value)}
              placeholder="Past behavior, workarounds, quotes..."
            />
          </div>
          {aiSummary && (
            <div className="rounded-ui border border-cta/20 bg-cta/5 p-4">
              <Badge variant="heat" className="mb-2">
                AI summary
              </Badge>
              <p className="font-sans text-sm text-ink">{aiSummary}</p>
            </div>
          )}
          {extractedQuotes.length > 0 && (
            <div className="rounded-ui border border-rule-soft bg-paper-2 p-4">
              <p className="font-sans text-meta font-semibold uppercase tracking-wide text-ink-subtle">
                Extracted quotes
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-sm text-ink">
                {extractedQuotes.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => summarizeMutation.mutate()}
              disabled={interviewNotes.length < 20 || summarizeMutation.isPending}
            >
              {summarizeMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              )}
              Summarize
            </Button>
            <Button
              type="button"
              onClick={() => saveInterviewMutation.mutate()}
              disabled={
                !personLabel || interviewNotes.length < 10 || saveInterviewMutation.isPending
              }
            >
              Save interview
            </Button>
            <Button type="button" variant="ghost" onClick={() => setInterviewOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {evidenceOpen && (
        <Card className="space-y-4 p-5">
          <h2 className="font-sans text-section font-semibold text-ink">Add evidence</h2>
          <div className="space-y-2">
            <Label htmlFor="evidence-type">Type</Label>
            <select
              id="evidence-type"
              className="w-full rounded-ui border border-rule-soft bg-paper px-3 py-2 font-sans text-body"
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value)}
            >
              <option value="interview_quote">Interview quote</option>
              <option value="experiment_metric">Experiment metric</option>
              <option value="loi">LOI</option>
              <option value="payment">Payment</option>
              <option value="founder_note">Founder note</option>
              <option value="competitor_research">Competitor research</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="evidence-content">Content</Label>
            <Textarea
              id="evidence-content"
              rows={4}
              value={evidenceContent}
              onChange={(e) => {
                setEvidenceContent(e.target.value);
                setMappedAssumptionIds([]);
                setMapRationale(null);
              }}
            />
          </div>
          {mappedAssumptionIds.length > 0 && (
            <p className="font-sans text-sm text-ink-muted">
              Suggested links: {mappedAssumptionIds.length} assumption(s)
              {mapRationale ? ` — ${mapRationale}` : ""}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => mapEvidenceMutation.mutate()}
              disabled={evidenceContent.length < 10 || mapEvidenceMutation.isPending}
            >
              Suggest assumption links
            </Button>
            <Button
              type="button"
              onClick={() => saveEvidenceMutation.mutate()}
              disabled={evidenceContent.length < 1 || saveEvidenceMutation.isPending}
            >
              Save evidence
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEvidenceOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {experimentOpen && experimentDraft && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <h2 className="font-sans text-section font-semibold text-ink">Experiment draft</h2>
            <Badge variant="heat">AI draft</Badge>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-title">Title</Label>
            <Input
              id="exp-title"
              value={experimentDraft.title ?? ""}
              onChange={(e) =>
                setExperimentDraft((d) => ({ ...d, title: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-hypothesis">Hypothesis</Label>
            <Textarea
              id="exp-hypothesis"
              rows={2}
              value={experimentDraft.hypothesis ?? ""}
              onChange={(e) =>
                setExperimentDraft((d) => ({ ...d, hypothesis: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-threshold">Pass / fail threshold</Label>
            <Textarea
              id="exp-threshold"
              rows={2}
              value={experimentDraft.pass_fail_threshold ?? ""}
              onChange={(e) =>
                setExperimentDraft((d) => ({ ...d, pass_fail_threshold: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => saveExperimentMutation.mutate()}>
              Create experiment
            </Button>
            <Button type="button" variant="ghost" onClick={() => setExperimentOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <section aria-labelledby="assumption-board-heading">
        <h2
          id="assumption-board-heading"
          className="font-sans text-section font-semibold text-ink"
        >
          Assumption board
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {ASSUMPTION_COLUMNS.map((col) => (
            <div key={col} className="min-w-0 space-y-2">
              <h3 className="font-sans text-meta font-semibold uppercase tracking-wide text-ink-subtle">
                {COLUMN_LABEL[col]}
              </h3>
              <ul className="space-y-2">
                {byColumn[col].map((a) => (
                  <li key={a.id}>
                    <Card className="p-3">
                      <p className="font-sans text-sm text-ink">{a.statement}</p>
                      <p className="mt-1 font-sans text-xs text-ink-muted">{a.type}</p>
                      {col !== "retired" && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {ASSUMPTION_COLUMNS.filter((s) => s !== a.status).map((next) => (
                            <button
                              key={next}
                              type="button"
                              className="rounded-ui border border-rule-soft px-1.5 py-0.5 font-sans text-xs text-ink-muted hover:bg-paper-2"
                              onClick={() => statusMutation.mutate({ id: a.id, status: next })}
                            >
                              → {COLUMN_LABEL[next]}
                            </button>
                          ))}
                        </div>
                      )}
                    </Card>
                  </li>
                ))}
                {byColumn[col].length === 0 && (
                  <p className="font-sans text-xs text-ink-muted">Empty</p>
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="experiments-heading">
        <h2 id="experiments-heading" className="font-sans text-section font-semibold text-ink">
          Experiments
        </h2>
        <ul className="mt-3 space-y-3">
          {experiments.map((ex) => (
            <li key={ex.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-sans text-body font-medium text-ink">{ex.title}</p>
                    <p className="mt-1 font-sans text-sm text-ink-muted">{ex.hypothesis}</p>
                    {ex.pass_fail_threshold && (
                      <p className="mt-2 font-sans text-xs text-ink-subtle">
                        Threshold: {ex.pass_fail_threshold}
                      </p>
                    )}
                  </div>
                  <Badge variant="default">{ex.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ex.status === "planned" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        experimentStatusMutation.mutate({ id: ex.id, status: "active" })
                      }
                    >
                      Start
                    </Button>
                  )}
                  {ex.status === "active" && completingExperimentId !== ex.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCompletingExperimentId(ex.id)}
                    >
                      Complete
                    </Button>
                  )}
                </div>
                {completingExperimentId === ex.id && (
                  <div className="mt-4 space-y-3 border-t border-rule-soft pt-4">
                    <div className="space-y-2">
                      <Label htmlFor={`result-${ex.id}`}>Result</Label>
                      <Textarea
                        id={`result-${ex.id}`}
                        rows={2}
                        value={experimentResult}
                        onChange={(e) => setExperimentResult(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`decision-${ex.id}`}>Decision</Label>
                      <select
                        id={`decision-${ex.id}`}
                        className="w-full rounded-ui border border-rule-soft bg-paper px-3 py-2 font-sans text-body"
                        value={experimentDecision}
                        onChange={(e) => setExperimentDecision(e.target.value)}
                      >
                        <option value="continue">Continue</option>
                        <option value="revise">Revise</option>
                        <option value="pivot">Pivot</option>
                        <option value="kill">Kill</option>
                        <option value="retest">Retest</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          experimentStatusMutation.mutate({
                            id: ex.id,
                            status: "completed",
                            result: experimentResult,
                            decision: experimentDecision,
                          })
                        }
                      >
                        Save decision
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setCompletingExperimentId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          ))}
          {experiments.length === 0 && (
            <p className="font-sans text-body text-ink-muted">No experiments yet.</p>
          )}
        </ul>
      </section>

      <section aria-labelledby="evidence-heading">
        <h2 id="evidence-heading" className="font-sans text-section font-semibold text-ink">
          Evidence log
        </h2>
        <ul className="mt-3 space-y-2">
          {evidence.map((ev) => (
            <li key={ev.id}>
              <Card className="p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">{ev.type}</Badge>
                  <Badge variant="default">{ev.strength}</Badge>
                </div>
                <p className="mt-2 font-sans text-body text-ink">{ev.content}</p>
              </Card>
            </li>
          ))}
          {evidence.length === 0 && (
            <p className="font-sans text-body text-ink-muted">No evidence logged yet.</p>
          )}
        </ul>
      </section>

      <section aria-labelledby="interviews-heading">
        <h2 id="interviews-heading" className="font-sans text-section font-semibold text-ink">
          Interviews ({interviews.length})
        </h2>
        <ul className="mt-3 space-y-2">
          {interviews.map((iv) => (
            <li key={iv.id}>
              <Card className="p-4">
                <p className="font-sans text-body font-medium text-ink">{iv.person_label}</p>
                <p className="mt-1 line-clamp-3 font-sans text-sm text-ink-muted">{iv.notes}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
