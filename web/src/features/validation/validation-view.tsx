"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getValidationOverview,
  listAssumptions,
  listEvidence,
  listExperiments,
  listInterviews,
  validationDataQueryKey,
  validationOverviewQueryKey,
  type CompetitorIntelItem,
  type Experiment,
} from "@/lib/api/workspaces";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";

import { AssumptionBoard } from "./assumption-board";
import { EvidenceLog } from "./evidence-log";
import { ExperimentsList } from "./experiments-list";
import { InterviewsList } from "./interviews-list";
import { useValidationMutations } from "./use-validation-mutations";
import { ValidationActionBar } from "./validation-action-bar";
import { ValidationPageChrome } from "./validation-page-chrome";
import { EvidenceDialog } from "./evidence-dialog";
import { EMPTY_EXPERIMENT_DRAFT, ExperimentDialog } from "./experiment-dialog";
import { InterviewDialog } from "./interview-dialog";
import { ValidationProgressChecklist } from "./validation-progress-checklist";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: validationDataQueryKey(workspaceId),
    queryFn: () => fetchValidationBundle(workspaceId),
  });

  const overviewQuery = useQuery({
    queryKey: validationOverviewQueryKey(workspaceId),
    queryFn: () => getValidationOverview(workspaceId),
  });

  const mutations = useValidationMutations(workspaceId);

  // Open from ?log_interview=1 on mount (wizard deep-link); effect only clears the URL.
  const [interviewOpen, setInterviewOpen] = useState(
    () => searchParams.get("log_interview") === "1",
  );
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [questions, setQuestions] = useState<{ question: string; rationale: string }[]>([]);

  const [personLabel, setPersonLabel] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [extractedQuotes, setExtractedQuotes] = useState<string[]>([]);
  const [suggestedAssumptionIds, setSuggestedAssumptionIds] = useState<string[]>([]);

  const [evidenceType, setEvidenceType] = useState("interview_quote");
  const [evidenceContent, setEvidenceContent] = useState("");
  const [mappedAssumptionIds, setMappedAssumptionIds] = useState<string[]>([]);
  const [mapRationale, setMapRationale] = useState<string | null>(null);
  const [competitorScanResult, setCompetitorScanResult] = useState<string | null>(null);
  const [competitorIntel, setCompetitorIntel] = useState<CompetitorIntelItem[]>([]);
  const [competitorFindings, setCompetitorFindings] = useState<
    Array<{ title: string; url: string; snippet: string }>
  >([]);
  const [evidenceEditOpen, setEvidenceEditOpen] = useState(false);

  const [experimentDraft, setExperimentDraft] = useState<Partial<Experiment> | null>(null);
  const [experimentAiAssisted, setExperimentAiAssisted] = useState(false);
  const [completingExperimentId, setCompletingExperimentId] = useState<string | null>(null);
  const [experimentResult, setExperimentResult] = useState("");
  const [experimentDecision, setExperimentDecision] = useState("continue");
  const [revisePromptExperimentId, setRevisePromptExperimentId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("log_interview") !== "1") return;
    router.replace(`/workspaces/${workspaceId}/validation`, { scroll: false });
  }, [searchParams, router, workspaceId]);

  const resetInterview = () => {
    setPersonLabel("");
    setInterviewNotes("");
    setAiSummary(null);
    setExtractedQuotes([]);
    setSuggestedAssumptionIds([]);
    setQuestions([]);
  };

  const resetEvidence = () => {
    setEvidenceContent("");
    setMappedAssumptionIds([]);
    setMapRationale(null);
    setCompetitorScanResult(null);
    setCompetitorIntel([]);
    setCompetitorFindings([]);
    setEvidenceEditOpen(false);
  };

  const resetExperiment = () => {
    setExperimentDraft(null);
    setExperimentAiAssisted(false);
  };

  const openExperimentDialog = () => {
    setExperimentDraft({ ...EMPTY_EXPERIMENT_DRAFT });
    setExperimentAiAssisted(false);
    setExperimentOpen(true);
  };

  if (isLoading) {
    return (
      <ValidationPageChrome>
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </ValidationPageChrome>
    );
  }

  if (isError || !data) {
    return (
      <ValidationPageChrome>
        <p className="font-sans text-body text-fail" role="alert">
          Could not load validation data.
        </p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => void refetch()}>
          Retry
        </Button>
      </ValidationPageChrome>
    );
  }

  const { assumptions, experiments, evidence, interviews } = data;

  return (
    <ValidationPageChrome>
      <ValidationProgressChecklist
        overview={overviewQuery.data}
        isLoading={overviewQuery.isLoading}
        isError={overviewQuery.isError}
        onRetry={() => void overviewQuery.refetch()}
      />

      <ValidationActionBar
        overview={overviewQuery.data}
        mutations={mutations}
        onLogInterview={() => setInterviewOpen(true)}
        onAddEvidence={() => setEvidenceOpen(true)}
        onStartExperiment={openExperimentDialog}
        onQuestionsReady={(nextQuestions) => {
          setQuestions(nextQuestions);
          setInterviewOpen(true);
          toast.success("Interview questions ready");
        }}
        onCompetitorScanSuccess={(res) => {
          setCompetitorScanResult(res.suggested_evidence);
          setCompetitorIntel(res.intel);
          setCompetitorFindings(res.findings);
          setEvidenceType("ai_research");
          setEvidenceContent(res.suggested_evidence);
          setEvidenceEditOpen(false);
          setEvidenceOpen(true);
          if (res.available) {
            toast.success("Competitor research ready — save as evidence (Pitch keeps the short list)");
          } else {
            toast.error(res.suggested_evidence);
          }
        }}
      />

      <InterviewDialog
        open={interviewOpen}
        onOpenChange={setInterviewOpen}
        mutations={mutations}
        questions={questions}
        personLabel={personLabel}
        interviewNotes={interviewNotes}
        aiSummary={aiSummary}
        extractedQuotes={extractedQuotes}
        suggestedAssumptionIds={suggestedAssumptionIds}
        onPersonLabelChange={setPersonLabel}
        onNotesChange={setInterviewNotes}
        onSummarizeSuccess={(res) => {
          setAiSummary(res.summary);
          setExtractedQuotes(res.extracted_quotes);
          setSuggestedAssumptionIds(res.suggested_assumption_ids);
        }}
        onReset={resetInterview}
      />

      <EvidenceDialog
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        mutations={mutations}
        evidenceType={evidenceType}
        evidenceContent={evidenceContent}
        mappedAssumptionIds={mappedAssumptionIds}
        mapRationale={mapRationale}
        competitorIntel={competitorIntel}
        competitorScanResult={competitorScanResult}
        competitorFindings={competitorFindings}
        evidenceEditOpen={evidenceEditOpen}
        onEvidenceTypeChange={setEvidenceType}
        onEvidenceContentChange={(value) => {
          setEvidenceContent(value);
          setMappedAssumptionIds([]);
          setMapRationale(null);
        }}
        onEvidenceEditToggle={() => setEvidenceEditOpen((open) => !open)}
        onMapSuccess={(res) => {
          setMappedAssumptionIds(res.suggested_assumption_ids);
          setMapRationale(res.rationale);
        }}
        onReset={resetEvidence}
      />

      <ExperimentDialog
        open={experimentOpen}
        onOpenChange={setExperimentOpen}
        mutations={mutations}
        experimentDraft={experimentDraft}
        onDraftChange={setExperimentDraft}
        onReset={resetExperiment}
        aiAssisted={experimentAiAssisted}
        onAiAssistedChange={setExperimentAiAssisted}
      />

      <AssumptionBoard assumptions={assumptions} mutations={mutations} />

      <ExperimentsList
        workspaceId={workspaceId}
        experiments={experiments}
        mutations={mutations}
        completingExperimentId={completingExperimentId}
        experimentResult={experimentResult}
        experimentDecision={experimentDecision}
        revisePromptExperimentId={revisePromptExperimentId}
        onStartComplete={setCompletingExperimentId}
        onCancelComplete={() => setCompletingExperimentId(null)}
        onResultChange={setExperimentResult}
        onDecisionChange={setExperimentDecision}
        onDismissRevisePrompt={() => setRevisePromptExperimentId(null)}
        onExperimentCompleted={(decision, id) => {
          setCompletingExperimentId(null);
          setExperimentResult("");
          setExperimentDecision("continue");
          if (decision === "revise" || decision === "pivot") {
            setRevisePromptExperimentId(id);
          }
        }}
      />

      <EvidenceLog evidence={evidence} />
      <InterviewsList interviews={interviews} />
    </ValidationPageChrome>
  );
}
