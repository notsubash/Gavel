"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppealResultView } from "@/features/appeal/appeal-result";
import { CompleteExperimentModal } from "@/features/appeal/complete-experiment-modal";
import { EvidenceProgressDelta } from "@/features/appeal/evidence-progress-delta";
import { ScoreDeltaBadge } from "@/features/appeal/score-delta-badge";
import { HistoryConfidencePreview } from "@/features/history/history-confidence-preview";
import { WorkspaceHistoryRow } from "@/features/history/workspace-history-row";
import { ConfidenceBars } from "@/features/iteration/confidence-bars";
import { PostRoastHandoff } from "@/features/judges/post-roast-handoff";
import { ReadinessGateModal } from "@/features/judges/readiness-gate-modal";
import { DebateConsequenceBlock, DebateConsequenceView } from "@/features/run/debate-consequence-block";
import { DebateTranscript, DebateTurn } from "@/features/run/debate-transcript";
import { ExperimentCard } from "@/features/run/experiment-card";
import { JudgeColumn, JudgeColumnSkeleton } from "@/features/run/judge-column";
import { JudgeProfileChip } from "@/features/run/judge-profile-chip";
import { LatestImprovementCard } from "@/features/run/latest-improvement";
import { PhaseRail } from "@/features/run/phase-rail";
import { RelatedRoasts } from "@/features/run/related-roasts";
import { RunControls } from "@/features/run/run-controls";
import { RunMetricsBar } from "@/features/run/run-metrics-bar";
import { ScoreLollipopStrip } from "@/features/run/score-lollipop-strip";
import { SseReconnectBanner } from "@/features/run/sse-reconnect-banner";
import { SourcesPanel } from "@/features/run/sources-panel";
import { SynthesisBlock } from "@/features/run/synthesis-block";
import { VerdictCard } from "@/features/run/verdict-card";
import { VerdictTallyBar } from "@/features/run/verdict-tally";
import { VerdictStamp } from "@/features/run/verdict-stamp";
import { WorkflowBrief } from "@/features/run/workflow-brief";
import { AssumptionBoard } from "@/features/validation/assumption-board";
import { EvidenceDialog } from "@/features/validation/evidence-dialog";
import { ExperimentDialog } from "@/features/validation/experiment-dialog";
import { EvidenceLog } from "@/features/validation/evidence-log";
import { ExperimentsList } from "@/features/validation/experiments-list";
import { InterviewDialog } from "@/features/validation/interview-dialog";
import { InterviewsList } from "@/features/validation/interviews-list";
import { ValidationProgressChecklist } from "@/features/validation/validation-progress-checklist";
import { NextStepHero } from "@/features/workspace/next-step-hero";
import { WorksheetFieldRenderer } from "@/features/worksheet/worksheet-field-renderer";
import { WorksheetVersionDiff } from "@/features/worksheet/worksheet-version-diff";
import { WORKSHEET_FIELDS, worksheetDefaults, type WorksheetValues } from "@/features/worksheet/worksheet-schema";
import { ApiError } from "@/lib/api/client";
import { JUDGE_ORDER } from "@/lib/sse/types";
import { initialRunState } from "@/lib/sse/run-reducer";
import { secondaryCtaClass } from "@/lib/cta-classes";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Skeleton } from "@/ui/skeleton";
import { Slider } from "@/ui/slider";
import { Switch } from "@/ui/switch";
import { Textarea } from "@/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";

import {
  CONFIDENCE_SNAPSHOT,
  DEBATE_CONSEQUENCE,
  DEBATE_TURNS,
  DEMO_EXPERIMENT,
  EXPERIMENT_STATUSES,
  experimentWithStatus,
  KEYBOARD_VERDICTS,
  MOCK_APPEAL,
  MOCK_ASSUMPTIONS,
  MOCK_EVIDENCE,
  MOCK_HANDOFF_ITEMS,
  MOCK_INTERVIEWS,
  MOCK_LATEST_IMPROVEMENT,
  MOCK_OVERVIEW,
  MOCK_OVERVIEW_BLOCKED,
  MOCK_OVERVIEW_READY,
  MOCK_STARTUP_WORKSPACE,
  MOCK_STARTUP_WORKSPACE_EXPANDED,
  MOCK_WORKSPACE_EXPERIMENTS,
  partialRadarState,
  RESEARCH_FINDINGS,
  REVOTE_BASELINE,
  REVOTE_VERDICTS,
  SAMPLE_METRICS,
  STRUCTURED_GO,
  STRUCTURED_NO_GO,
  STRUCTURED_SYNTHESIS,
  mockVerdict,
  stubValidationMutations,
} from "./dev-fixtures.ts";
import { DevScoreRadarPanel } from "./dev-score-radar-panel.tsx";
import { WorkspaceListStatePanels } from "./dev-workspace-list-states.tsx";
import { WorksheetWizardMobileStepDemo } from "./dev-wizard-mobile-step.tsx";

const devQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

devQueryClient.setQueryData(["run", "demo-related-success", "similar"], {
  runs: [
    {
      run_id: "related-1",
      idea_preview: "AI compliance scheduling for mid-size hospitals",
      created_at: "2026-06-01T12:00:00Z",
      verdict_summary: { pass: 2, fail: 1, conditional: 2, avg_score: 5.4 },
    },
  ],
});

devQueryClient.setQueryDefaults(["run", "demo-related-loading", "similar"], {
  queryFn: () => new Promise<never>(() => {}),
  staleTime: Infinity,
});

devQueryClient.setQueryDefaults(["run", "demo-related-error", "similar"], {
  queryFn: () => Promise.reject(new ApiError(500, "Server error")),
  staleTime: Infinity,
});

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="col-span-12 border-t border-rule-soft pt-12 first:border-t-0 first:pt-0">
      <h2 className="font-sans text-2xl font-semibold text-ink">{title}</h2>
      <div className="mt-6 flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

function Subsection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full space-y-3">
      <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">{label}</p>
      {children}
    </div>
  );
}

devQueryClient.setQueryData(["run", "demo-related-empty", "similar"], { runs: [] });

const stubMutations = stubValidationMutations();
const pendingStatusMutations = stubValidationMutations({
  statusMutation: {
    mutate: () => {},
    isPending: true,
    variables: { id: "a1", status: "testing" },
  },
} as unknown as Partial<import("@/features/validation/use-validation-mutations").ValidationMutations>);

function WorksheetFieldDemo({
  variant,
}: {
  variant: "empty" | "filled" | "ai-draft" | "sharpening" | "error";
}) {
  const defaults: WorksheetValues =
    variant === "empty"
      ? worksheetDefaults
      : {
          ...worksheetDefaults,
          working_name: "ClinicFlow",
          audience: "Compliance leads at mid-size hospitals who manage audit prep weekly.",
          problem_statement: "Manual scheduling creates audit gaps and wasted admin hours.",
          current_workaround: "Spreadsheets plus email chains.",
          solution_statement: "AI-assisted scheduling tied to compliance checkpoints.",
          secret_sauce: "Compliance-specific workflow templates.",
          top_risky_assumption: "Leads will pay before workflow depth exists.",
          disconfirming_evidence: "Fewer than 3 of 5 interviews confirm top-three pain.",
          competitors: ["Calendly", "Notion"],
        };

  const { register, setValue, watch } = useForm<WorksheetValues>({ defaultValues: defaults });
  const field = WORKSHEET_FIELDS.find((f) => f.name === "audience") ?? WORKSHEET_FIELDS[1];

  return (
    <div className="w-full max-w-lg">
      <WorksheetFieldRenderer
        field={field}
        values={watch()}
        register={register}
        setValue={setValue}
        error={variant === "error" ? "At least 10 characters" : undefined}
        isAiDraft={variant === "ai-draft"}
        sharpening={variant === "sharpening" ? field.name : null}
        onSharpen={variant === "sharpening" ? () => {} : undefined}
        showSharpen={variant === "sharpening"}
      />
    </div>
  );
}

function DevGalleryContent() {
  const [sliderValue, setSliderValue] = useState([3]);
  const [switchOn, setSwitchOn] = useState(false);
  const [selectValue, setSelectValue] = useState("deepseek");
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [readinessDemo, setReadinessDemo] = useState<
    "ready" | "blocked" | "loading" | "error"
  >("ready");
  const [experimentModalOpen, setExperimentModalOpen] = useState(false);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false);
  const [experimentDraft, setExperimentDraft] = useState(MOCK_WORKSPACE_EXPERIMENTS[0]);
  const [evidenceType, setEvidenceType] = useState("founder_note");
  const [evidenceContent, setEvidenceContent] = useState("Three founders confirmed scheduling pain.");
  const [personLabel, setPersonLabel] = useState("Alex (clinic admin)");
  const [interviewNotes, setInterviewNotes] = useState("Spends 2h/week on manual scheduling.");
  const [completingExperimentId, setCompletingExperimentId] = useState<string | null>(null);
  const [experimentResult, setExperimentResult] = useState("");
  const [experimentDecision, setExperimentDecision] = useState("");
  const [revisePromptId, setRevisePromptId] = useState<string | null>(null);

  const radarPartial = partialRadarState();

  return (
    <TooltipProvider>
      <div className="col-span-12 space-y-4">
        <p className="font-sans text-sm font-semibold uppercase tracking-widest text-cta">
          Design system
        </p>
        <h1 className="font-sans text-title font-semibold text-ink md:text-display-md">
          Component gallery
        </h1>
        <p className="max-w-prose font-sans text-ink-muted">
          Every shipped primitive and signature component in loading, empty, error, and success
          states — grouped by surface.
        </p>
        <Link href="/workspaces" className={`mt-4 inline-flex ${secondaryCtaClass}`}>
          Back to workspaces
        </Link>
      </div>

      <Section title="Primitives">
        <Button>Primary action</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button disabled>Disabled</Button>
        <Button className="active:bg-cta/70" aria-pressed="true">
          Active (pressed demo)
        </Button>
        <Button disabled>
          <span className="inline-block size-4 animate-spin rounded-full border border-rule-soft border-t-transparent" />
          Loading
        </Button>

        <div className="w-full max-w-sm space-y-4">
          <Input placeholder="Empty" aria-label="Empty input" />
          <Input defaultValue="Filled value" aria-label="Filled input" />
          <Input disabled defaultValue="Disabled" aria-label="Disabled input" />
          <Input aria-invalid defaultValue="Bad input" aria-label="Error input" className="border-fail" />
          <Textarea placeholder="Empty textarea" aria-label="Empty textarea" />
        </div>

        <div className="w-full max-w-xs">
          <Select value={selectValue} onValueChange={setSelectValue}>
            <SelectTrigger aria-label="Model runtime">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deepseek">DeepSeek</SelectItem>
              <SelectItem value="local">Local</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select disabled>
          <SelectTrigger className="w-48" aria-label="Disabled select">
            <SelectValue placeholder="Disabled" />
          </SelectTrigger>
        </Select>

        <div className="w-full max-w-xs space-y-2">
          <Label>Rounds: {sliderValue[0]}</Label>
          <Slider min={1} max={5} step={1} value={sliderValue} onValueChange={setSliderValue} aria-label="Slider demo" />
        </div>
        <Switch checked={switchOn} onCheckedChange={setSwitchOn} aria-label="Switch demo" />
        <Switch disabled aria-label="Disabled switch" />

        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Card</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-sans text-sm text-ink-muted">Content area</p>
          </CardContent>
          <CardFooter>
            <Badge variant="heat">Streaming</Badge>
          </CardFooter>
        </Card>

        <Badge>Default</Badge>
        <Badge variant="pass">Pass</Badge>
        <Badge variant="fail">Fail</Badge>
        <Badge variant="conditional">Conditional</Badge>
        <Badge variant="heat">Heat</Badge>
        <Badge variant="pass">Pass — 3 judges</Badge>

        <Skeleton className="h-24 w-full max-w-sm" />

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stop this review?</DialogTitle>
              <DialogDescription>
                The judges will halt between turns. You can always start a new review.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary">Keep going</Button>
              <Button variant="destructive">Stop</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>Five judges, one decision.</TooltipContent>
        </Tooltip>

        <Button
          variant="secondary"
          onClick={() =>
            toast.error("Rate limited", { description: "Too many run requests. Try again shortly." })
          }
        >
          Rate-limit toast
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.error("Network error", { description: "Could not reach the API." })
          }
        >
          Network toast
        </Button>
        <Button variant="secondary" onClick={() => toast.success("Saved.")}>
          Success toast
        </Button>
      </Section>

      <Section title="Run — review workflow">
        <Subsection label="PhaseRail">
          <div className="flex w-full flex-wrap gap-6">
            <div>
              <p className="mb-2 font-sans text-xs text-ink-subtle">Complete (null phase)</p>
              <PhaseRail phase={null} />
            </div>
            <div>
              <p className="mb-2 font-sans text-xs text-ink-subtle">Review active</p>
              <PhaseRail phase="roast" />
            </div>
            <div>
              <p className="mb-2 font-sans text-xs text-ink-subtle">Debate active</p>
              <PhaseRail phase="debate" />
            </div>
            <div>
              <p className="mb-2 font-sans text-xs text-ink-subtle">Synthesis active</p>
              <PhaseRail phase="synthesis" />
            </div>
          </div>
        </Subsection>

        <Subsection label="VerdictCard">
          <div className="grid w-full gap-6 lg:grid-cols-2">
            <VerdictCard synthesisProse={null} structuredSynthesis={null} verdicts={[]} />
            <VerdictCard
              synthesisProse="Unstructured prose without numbered sections — low confidence."
              structuredSynthesis={null}
              verdicts={[KEYBOARD_VERDICTS[0]]}
            />
            <VerdictCard
              synthesisProse="**Recommendation:** ITERATE\n\nUnparseable prose fallback."
              structuredSynthesis={null}
              verdicts={KEYBOARD_VERDICTS.slice(0, 2)}
            />
            <VerdictCard
              synthesisProse={null}
              structuredSynthesis={STRUCTURED_SYNTHESIS}
              verdicts={KEYBOARD_VERDICTS}
            />
            <VerdictCard synthesisProse={null} structuredSynthesis={STRUCTURED_GO} verdicts={KEYBOARD_VERDICTS} />
            <VerdictCard synthesisProse={null} structuredSynthesis={STRUCTURED_NO_GO} verdicts={KEYBOARD_VERDICTS} />
          </div>
        </Subsection>

        <Subsection label="JudgeColumn">
          <div className="grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {JUDGE_ORDER.map((id) => (
              <JudgeColumnSkeleton key={`sk-${id}`} judgeId={id} />
            ))}
            <JudgeColumn judgeId="vc" view={{ status: "idle" }} />
            <JudgeColumn judgeId="engineer" view={{ status: "thinking" }} />
            <JudgeColumn judgeId="pm" view={{ status: "revealed", verdict: mockVerdict("pm") }} animateStamp />
            <JudgeColumn judgeId="customer" view={{ status: "failed" }} />
            <JudgeColumn
              judgeId="vc"
              view={{ status: "revealed", verdict: REVOTE_VERDICTS[0] }}
              baselineVerdict={REVOTE_BASELINE.vc}
              scoreDelta={2}
              scoreChangeReason="Engineer shifted my read on feasibility."
            />
            <div className="col-span-full">
              <p className="mb-3 font-sans text-xs text-ink-subtle">Partial panel (2 of 5 revealed)</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {JUDGE_ORDER.map((id) => (
                  <JudgeColumn
                    key={`partial-${id}`}
                    judgeId={id}
                    view={radarPartial.judges[id]}
                    animateStamp={radarPartial.judges[id].status === "revealed"}
                  />
                ))}
              </div>
            </div>
          </div>
        </Subsection>

        <Subsection label="JudgeProfileChip">
          <div className="flex flex-wrap gap-3">
            {JUDGE_ORDER.map((id) => (
              <JudgeProfileChip key={`stance-${id}`} judgeId={id} verdict="PASS" showRole />
            ))}
            <JudgeProfileChip judgeId="vc" showStance={false} showRole />
          </div>
        </Subsection>

        <Subsection label="DebateTranscript">
          <div className="w-full max-w-2xl space-y-6">
            <DebateTranscript turns={[]} currentRound={null} />
            <DebateTranscript
              turns={[
                {
                  speaker: "pm",
                  round: 1,
                  content: "",
                  streaming: false,
                  thinking: true,
                },
              ]}
              currentRound={1}
            />
            <DebateTranscript turns={DEBATE_TURNS.slice(0, 2)} currentRound={2} />
            <DebateTurn turn={DEBATE_TURNS[2]} />
          </div>
        </Subsection>

        <Subsection label="SynthesisBlock">
          <div className="w-full max-w-xl space-y-4">
            <SynthesisBlock content={null} />
            <SynthesisBlock content="Plain prose without numbered sections." />
            <SynthesisBlock content={"1. **Round 1** — VC challenged wedge.\n2. **Round 2** — Engineer noted feasibility."} />
          </div>
        </Subsection>

        <Subsection label="DebateConsequenceBlock">
          <div className="w-full max-w-xl space-y-6">
            {DEBATE_CONSEQUENCE && <DebateConsequenceView consequence={DEBATE_CONSEQUENCE} />}
            <DebateConsequenceBlock
              structuredSynthesis={STRUCTURED_SYNTHESIS}
              synthesisProse={null}
              verdicts={KEYBOARD_VERDICTS}
              revoteBaseline={{}}
              revoteChangeReasons={{}}
              topProblems={STRUCTURED_SYNTHESIS.top_problems}
            />
          </div>
        </Subsection>

        <Subsection label="WorkflowBrief">
          <div className="w-full max-w-xl space-y-6">
            <WorkflowBrief
              synthesisProse={null}
              structuredSynthesis={{ ...STRUCTURED_SYNTHESIS, top_problems: [STRUCTURED_SYNTHESIS.top_problems[0]] }}
              verdicts={KEYBOARD_VERDICTS}
              experiment={DEMO_EXPERIMENT}
              completed={false}
            />
            <WorkflowBrief
              synthesisProse={null}
              structuredSynthesis={STRUCTURED_SYNTHESIS}
              verdicts={KEYBOARD_VERDICTS}
              experiment={DEMO_EXPERIMENT}
              completed={false}
            />
            <WorkflowBrief
              synthesisProse={null}
              structuredSynthesis={STRUCTURED_SYNTHESIS}
              verdicts={KEYBOARD_VERDICTS}
              experiment={DEMO_EXPERIMENT}
              completed
              runId="demo-run"
              evidenceLink={{ href: "#", label: "Present evidence", useModal: true }}
            />
          </div>
        </Subsection>

        <Subsection label="ExperimentCard">
          <div className="grid w-full gap-4 md:grid-cols-2">
            {EXPERIMENT_STATUSES.map((status) => (
              <ExperimentCard key={status} experiment={experimentWithStatus(status)} />
            ))}
          </div>
        </Subsection>

        <Subsection label="ConfidenceBars">
          <div className="w-full max-w-md space-y-6">
            <ConfidenceBars snapshot={CONFIDENCE_SNAPSHOT} />
            <ConfidenceBars snapshot={CONFIDENCE_SNAPSHOT} defaultWhyOpen />
            <ConfidenceBars snapshot={CONFIDENCE_SNAPSHOT} compact showWhy={false} />
          </div>
        </Subsection>

        <Subsection label="LatestImprovement">
          <LatestImprovementCard improvement={MOCK_LATEST_IMPROVEMENT} className="w-full max-w-xl" />
        </Subsection>

        <Subsection label="SourcesPanel">
          <SourcesPanel research={RESEARCH_FINDINGS} headingLevel="h3" />
        </Subsection>

        <Subsection label="RelatedRoasts">
          <div className="grid w-full gap-8 md:grid-cols-2 xl:grid-cols-4">
            <RelatedRoasts runId="demo-related-loading" />
            <RelatedRoasts runId="demo-related-error" />
            <RelatedRoasts runId="demo-related-empty" />
            <RelatedRoasts runId="demo-related-success" />
          </div>
        </Subsection>

        <Subsection label="SSE reconnect">
          <div className="w-full max-w-xl space-y-4">
            <SseReconnectBanner reconnecting status="running" />
            <SseReconnectBanner reconnecting={false} status="running" />
          </div>
        </Subsection>

        <Subsection label="RunControls & metrics">
          <div className="w-full space-y-6">
            <RunControls runId="demo-running" status="running" />
            <RunControls
              runId="demo-complete"
              status="completed"
              exportInput={{
                idea: "AI scheduling for clinics.",
                runId: "demo-complete",
                judges: radarPartial.judges,
                debateTurns: DEBATE_TURNS,
                synthesis: "Needs sharper positioning.",
                metrics: SAMPLE_METRICS,
              }}
            />
            <RunControls runId="demo-failed" status="failed" exportInput={null} />
            <RunMetricsBar metrics={null} status="running" />
            <RunMetricsBar metrics={null} status="failed" />
            <RunMetricsBar metrics={SAMPLE_METRICS} status="completed" />
          </div>
        </Subsection>

        <Subsection label="VerdictStamp & tally (dev-only viz flagged)">
          <VerdictStamp verdict="PASS" animate />
          <VerdictStamp verdict="FAIL" />
          <VerdictStamp verdict="CONDITIONAL" />
          <div className="w-full max-w-xl">
            <VerdictTallyBar judges={initialRunState().judges} />
            <ScoreLollipopStrip judges={radarPartial.judges} />
          </div>
          <p className="w-full font-sans text-xs text-ink-subtle">
            ScoreRadar / VerdictTallyBar / ScoreLollipopStrip — dev-only, not used in production run UI.
          </p>
          <DevScoreRadarPanel partialJudges={radarPartial.judges} />
        </Subsection>
      </Section>

      <Section title="Appeal & evidence">
        <ScoreDeltaBadge delta={1.2} animate />
        <ScoreDeltaBadge delta={-0.8} />
        <ScoreDeltaBadge delta={0} />
        <EvidenceProgressDelta appeal={MOCK_APPEAL} confidenceBefore="LOW" className="w-full max-w-xl" />
        <AppealResultView appeal={MOCK_APPEAL} embedded />
        <Button variant="secondary" onClick={() => setExperimentModalOpen(true)}>
          Open CompleteExperimentModal
        </Button>
        <CompleteExperimentModal
          runId="demo-run"
          open={experimentModalOpen}
          onOpenChange={setExperimentModalOpen}
          targetJudges={["customer", "vc"]}
          baselineVerdicts={KEYBOARD_VERDICTS}
          experiment={DEMO_EXPERIMENT}
          onSuccess={() => toast.success("Appeal submitted (demo).")}
        />
      </Section>

      <Section title="Workspace & worksheet">
        <Subsection label="WorkspaceList">
          <WorkspaceListStatePanels />
        </Subsection>

        <Subsection label="NextStepHero">
          <div className="grid w-full gap-6 lg:grid-cols-2">
            <NextStepHero
              workspaceId="ws-demo"
              lifecycle="discovery"
              overview={MOCK_OVERVIEW}
              overviewLoading={false}
              overviewError={false}
              coachNarrative={null}
            />
            <NextStepHero
              workspaceId="ws-demo"
              lifecycle="testing"
              overview={MOCK_OVERVIEW_READY}
              overviewLoading={false}
              overviewError={false}
              coachNarrative="Focus on buyer interviews before expanding scope."
            />
            <NextStepHero
              workspaceId="ws-demo"
              lifecycle="discovery"
              overview={null}
              overviewLoading
              overviewError={false}
              coachNarrative={null}
            />
            <NextStepHero
              workspaceId="ws-demo"
              lifecycle="discovery"
              overview={null}
              overviewLoading={false}
              overviewError
              coachNarrative={null}
              onRetryOverview={() => toast.info("Retry (demo)")}
            />
          </div>
        </Subsection>

        <Subsection label="WorksheetFieldRenderer">
          <WorksheetFieldDemo variant="empty" />
          <WorksheetFieldDemo variant="filled" />
          <WorksheetFieldDemo variant="ai-draft" />
          <WorksheetFieldDemo variant="sharpening" />
          <WorksheetFieldDemo variant="error" />
        </Subsection>

        <Subsection label="WorksheetVersionDiff">
          <WorksheetVersionDiff changes={[]} className="w-full max-w-lg" />
          <WorksheetVersionDiff
            className="w-full max-w-lg"
            changeSummary="Sharpened ICP after buyer interviews."
            changes={[
              {
                field: "audience",
                label: "Audience",
                before: "Healthcare admins",
                after: "Compliance leads at mid-size hospitals",
                is_core: true,
              },
            ]}
          />
        </Subsection>

        <Subsection label="Worksheet wizard — mobile step">
          <WorksheetWizardMobileStepDemo />
        </Subsection>
      </Section>

      <Section title="Validation">
        <ValidationProgressChecklist overview={MOCK_OVERVIEW} isLoading={false} isError={false} onRetry={() => {}} />
        <ValidationProgressChecklist overview={undefined} isLoading isError={false} onRetry={() => {}} />
        <ValidationProgressChecklist overview={undefined} isLoading={false} isError onRetry={() => toast.info("Retry")} />

        <AssumptionBoard assumptions={MOCK_ASSUMPTIONS} mutations={stubMutations} />
        <AssumptionBoard assumptions={[]} mutations={stubMutations} />
        <AssumptionBoard assumptions={MOCK_ASSUMPTIONS} mutations={pendingStatusMutations} />

        <ExperimentsList
          workspaceId="ws-demo"
          experiments={MOCK_WORKSPACE_EXPERIMENTS}
          mutations={stubMutations}
          completingExperimentId={completingExperimentId}
          experimentResult={experimentResult}
          experimentDecision={experimentDecision}
          revisePromptExperimentId={revisePromptId}
          onStartComplete={setCompletingExperimentId}
          onCancelComplete={() => setCompletingExperimentId(null)}
          onResultChange={setExperimentResult}
          onDecisionChange={setExperimentDecision}
          onDismissRevisePrompt={() => setRevisePromptId(null)}
          onExperimentCompleted={() => setRevisePromptId("e2")}
        />
        <Button variant="outline" size="sm" onClick={() => setCompletingExperimentId("e1")}>
          Show experiment complete form
        </Button>

        <EvidenceLog evidence={[]} />
        <EvidenceLog evidence={MOCK_EVIDENCE} />
        <InterviewsList interviews={[]} />
        <InterviewsList interviews={MOCK_INTERVIEWS} />

        <Subsection label="Validation dialogs">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEvidenceDialogOpen(true)}>
              EvidenceDialog
            </Button>
            <Button variant="secondary" onClick={() => setInterviewDialogOpen(true)}>
              InterviewDialog
            </Button>
            <Button variant="secondary" onClick={() => setExperimentDialogOpen(true)}>
              ExperimentDialog
            </Button>
          </div>
          <EvidenceDialog
            open={evidenceDialogOpen}
            onOpenChange={setEvidenceDialogOpen}
            mutations={stubMutations}
            evidenceType={evidenceType}
            evidenceContent={evidenceContent}
            mappedAssumptionIds={[]}
            mapRationale={null}
            competitorIntel={[]}
            competitorScanResult={null}
            competitorFindings={[]}
            evidenceEditOpen={false}
            onEvidenceTypeChange={setEvidenceType}
            onEvidenceContentChange={setEvidenceContent}
            onEvidenceEditToggle={() => {}}
            onMapSuccess={() => {}}
            onReset={() => setEvidenceContent("")}
          />
          <InterviewDialog
            open={interviewDialogOpen}
            onOpenChange={setInterviewDialogOpen}
            mutations={stubMutations}
            questions={[
              { question: "Do they rank audit prep unprompted?", rationale: "Problem validation" },
            ]}
            personLabel={personLabel}
            interviewNotes={interviewNotes}
            aiSummary={null}
            extractedQuotes={[]}
            suggestedAssumptionIds={[]}
            onPersonLabelChange={setPersonLabel}
            onNotesChange={setInterviewNotes}
            onSummarizeSuccess={() => {}}
            onReset={() => setInterviewNotes("")}
          />
          <ExperimentDialog
            open={experimentDialogOpen}
            onOpenChange={setExperimentDialogOpen}
            mutations={stubMutations}
            experimentDraft={experimentDraft}
            onDraftChange={(draft) =>
              setExperimentDraft((prev) => ({ ...prev, ...draft }))
            }
            onReset={() => setExperimentDraft(MOCK_WORKSPACE_EXPERIMENTS[0])}
          />
        </Subsection>
      </Section>

      <Section title="Judges & history">
        <div className="flex flex-wrap gap-2">
          {(["ready", "blocked", "loading", "error"] as const).map((demo) => (
            <Button
              key={demo}
              variant="secondary"
              size="sm"
              onClick={() => {
                setReadinessDemo(demo);
                setReadinessOpen(true);
              }}
            >
              ReadinessGate — {demo}
            </Button>
          ))}
        </div>
        <ReadinessGateModal
          open={readinessOpen}
          onOpenChange={setReadinessOpen}
          readiness={
            readinessDemo === "loading" || readinessDemo === "error"
              ? null
              : readinessDemo === "ready"
                ? MOCK_OVERVIEW_READY.readiness
                : MOCK_OVERVIEW_BLOCKED.readiness
          }
          readinessLoading={readinessDemo === "loading"}
          readinessError={readinessDemo === "error"}
          onRetryReadiness={() => toast.info("Retry readiness (demo)")}
          briefing={readinessDemo === "ready" ? "Worksheet and evidence checks passed." : null}
          briefingLoading={false}
          onFetchBriefing={() => toast.info("Fetch briefing (demo)")}
          onLaunch={() => toast.success("Launch (demo)")}
          launching={false}
        />

        <PostRoastHandoff workspaceId="ws-demo" runId="run-demo" items={MOCK_HANDOFF_ITEMS} />

        <div className="w-full max-w-3xl space-y-6">
          <WorkspaceHistoryRow workspace={MOCK_STARTUP_WORKSPACE} />
          <WorkspaceHistoryRow workspace={MOCK_STARTUP_WORKSPACE_EXPANDED} />
        </div>
        <HistoryConfidencePreview runId="child-2" enabled={false} />
      </Section>
    </TooltipProvider>
  );
}

export function DevGallery() {
  return (
    <QueryClientProvider client={devQueryClient}>
      <DevGalleryContent />
    </QueryClientProvider>
  );
}
