import { JUDGE_ORDER } from "@/lib/sse/types";
import type { AppealResult, DebateTurnView, JudgeId, Verdict } from "@/lib/sse/types";
import type { Assumption, Experiment, ValidationOverview } from "@/lib/api/workspaces";
import type { ConfidenceSnapshot } from "@/lib/confidence/confidence";
import { deriveExperiment } from "@/lib/experiment/experiment";
import { initialRunState } from "@/lib/sse/run-reducer";
import type { StartupWorkspace } from "@/lib/lineage/workspace";
import type { LatestImprovement } from "@/lib/lineage/latest-improvement";
import { deriveDebateConsequence } from "@/lib/debate/debate-consequence";
import type { ValidationMutations } from "@/features/validation/use-validation-mutations";

/** ponytail: minimal no-op mutations for /dev dialog harnesses. */
export function stubValidationMutations(
  over?: Partial<ValidationMutations>,
): ValidationMutations {
  const noop = {
    mutate: () => {},
    mutateAsync: async () => ({}),
    isPending: false,
    isError: false,
    isSuccess: false,
    variables: undefined,
    reset: () => {},
    status: "idle" as const,
  };

  return {
    invalidate: () => {},
    questionsMutation: noop,
    summarizeMutation: noop,
    saveInterviewMutation: noop,
    mapEvidenceMutation: noop,
    saveEvidenceMutation: noop,
    suggestExperimentMutation: noop,
    competitorScanMutation: noop,
    saveExperimentMutation: noop,
    statusMutation: noop,
    experimentStatusMutation: noop,
    ...over,
  } as unknown as ValidationMutations;
}

export const STRUCTURED_SYNTHESIS = {
  overall_recommendation: "ITERATE" as const,
  confidence: "MEDIUM",
  top_strengths: ["Clear pain point in audit prep."],
  top_risks: ["No buyer proof yet.", "Long sales cycles."],
  top_problems: ["No buyer proof yet.", "Long sales cycles.", "Unclear wedge."],
  highest_priority: "Validate that compliance leads will pay before building more workflow.",
  biggest_disagreement: "VC and PM disagree on wedge size.",
  recommended_experiment: {
    title: "Run five buyer interviews with compliance leads.",
    audience: "Compliance leads at mid-size hospitals",
    hypothesis: "Buyers rank audit prep as a top-three weekly pain.",
    questions: [
      "Do they rank audit prep unprompted?",
      "What tools do they use today?",
      "Would they pilot a one-hour-saving workflow?",
    ],
    effort_minutes: 120,
  },
};

export const STRUCTURED_GO = {
  ...STRUCTURED_SYNTHESIS,
  overall_recommendation: "GO" as const,
  confidence: "HIGH",
};

export const STRUCTURED_NO_GO = {
  overall_recommendation: "NO-GO" as const,
  confidence: "HIGH",
  top_strengths: ["Visually appealing novelty."],
  top_risks: ["Every judge concluded this fails as a venture investment."],
  top_problems: [
    "Zero switching costs block repeat revenue.",
    "No validated ICP experiences the pain as costly enough to buy.",
    "Incumbents dominate distribution.",
  ],
  biggest_disagreement: "VC vs Engineer on strategic vs operational fatal flaw.",
};

export const KEYBOARD_VERDICTS: Verdict[] = [
  {
    judge: "pm",
    verdict: "FAIL",
    roast: "ICP unclear.",
    score: 2,
    key_concern: "No evidence any segment experiences this pain.",
    recommended_fix: "Run 15 structured interviews with target buyers.",
    evidence_to_change_verdict: "Show ten transcripts naming this as a top-three frustration.",
  },
  {
    judge: "customer",
    verdict: "FAIL",
    roast: "Would not pay.",
    score: 3,
    key_concern: "No urgency.",
    evidence_to_change_verdict: "Paid pilot LOI.",
  },
  {
    judge: "vc",
    verdict: "CONDITIONAL",
    roast: "Wedge plausible.",
    score: 5,
    key_concern: "Market size unproven.",
  },
  {
    judge: "engineer",
    verdict: "PASS",
    roast: "Buildable.",
    score: 7,
    key_concern: "Ops risk at scale.",
  },
  {
    judge: "competitor",
    verdict: "FAIL",
    roast: "Crowded.",
    score: 4,
    key_concern: "Incumbents dominate.",
  },
];

export function mockVerdict(judge: JudgeId, overrides?: Partial<Verdict>): Verdict {
  const base = KEYBOARD_VERDICTS.find((v) => v.judge === judge) ?? KEYBOARD_VERDICTS[0];
  return { ...base, judge, ...overrides };
}

export const REVOTE_BASELINE = {
  vc: mockVerdict("vc", {
    verdict: "FAIL",
    score: 3,
    key_concern: "No buyer proof.",
    evidence_to_change_verdict: "Three LOIs.",
  }),
};

export const REVOTE_VERDICTS = [
  mockVerdict("vc", {
    verdict: "CONDITIONAL",
    score: 5,
    key_concern: "Wedge is plausible if proof lands.",
    evidence_to_change_verdict: "Engineer shifted my read on feasibility.",
  }),
];

export const DEBATE_TURNS: DebateTurnView[] = [
  {
    speaker: "vc",
    round: 1,
    content: "Crowded category — where is the wedge?",
    streaming: false,
    thinking: false,
  },
  {
    speaker: "engineer",
    round: 1,
    content: "Technically feasible if scope stays narrow.",
    streaming: false,
    thinking: false,
  },
  {
    speaker: "moderator",
    round: 2,
    content: "Summarizing the split on buyer proof…",
    streaming: true,
    thinking: false,
  },
];

export const SAMPLE_METRICS = {
  roast_seconds: 4.2,
  debate_seconds: 11.8,
  total_seconds: 16,
  input_tokens: 2100,
  output_tokens: 980,
  total_tokens: 3080,
  estimated_cost_usd: 0.004,
  model_runtime: "deepseek" as const,
  judge_calls: [
    {
      label: "vc",
      phase: "roast" as const,
      seconds: 1.2,
      input_tokens: 400,
      output_tokens: 120,
      total_tokens: 520,
    },
  ],
  debate_calls: [
    {
      label: "round-1-vc",
      phase: "debate" as const,
      seconds: 2.4,
      input_tokens: 600,
      output_tokens: 200,
      total_tokens: 800,
    },
  ],
};

export const RESEARCH_FINDINGS = {
  query: "compliance scheduling tools",
  findings: [
    {
      title: "Calendly for healthcare",
      url: "https://calendly.com",
      snippet: "General scheduling — not compliance-specific.",
    },
    {
      title: "Broken link example",
      url: "not-a-url",
      snippet: "Malformed URL renders as plain text.",
    },
  ],
};

export const CONFIDENCE_SNAPSHOT: ConfidenceSnapshot = {
  dimensions: [
    { dimension: "demand", label: "Demand", value: 35, tier: "Low", driver: "No buyer urgency proof.", nextAction: "Run five buyer interviews." },
    { dimension: "pricing", label: "Pricing", value: 55, tier: "Medium", driver: "Willingness to pay unclear.", nextAction: "Test two price points." },
    { dimension: "competition", label: "Competition", value: 40, tier: "Low", driver: "Incumbents are strong.", nextAction: "Document a wedge." },
    { dimension: "moat", label: "Moat", value: 62, tier: "Medium", driver: "Defensibility is early.", nextAction: "File provisional IP." },
  ],
  weakest: "demand",
  source: "llm",
};

export const DEMO_EXPERIMENT = deriveExperiment(
  "demo-run-id",
  null,
  STRUCTURED_SYNTHESIS,
  KEYBOARD_VERDICTS,
);

export const EXPERIMENT_STATUSES = ["suggested", "in_progress", "submitted", "reviewed"] as const;

export function experimentWithStatus(status: (typeof EXPERIMENT_STATUSES)[number]) {
  return { ...DEMO_EXPERIMENT, status };
}

export const DEBATE_CONSEQUENCE = deriveDebateConsequence({
  structuredSynthesis: STRUCTURED_SYNTHESIS,
  synthesisProse: null,
  verdicts: REVOTE_VERDICTS,
  revoteBaseline: REVOTE_BASELINE,
  revoteChangeReasons: { vc: "Engineer shifted my read on feasibility." },
  topProblems: STRUCTURED_SYNTHESIS.top_problems,
});

export const MOCK_OVERVIEW: ValidationOverview = {
  checklist: {
    next_action: "Run your active experiment and log results.",
    next_stage: "solution_evidence",
    items: [
      { stage: "problem_clarity", label: "Problem clarity", completed: true, completed_at: null, auto_completed: true },
      { stage: "problem_evidence", label: "Problem evidence", completed: true, completed_at: null, auto_completed: false },
      { stage: "solution_evidence", label: "Solution evidence", completed: false, completed_at: null, auto_completed: false },
      { stage: "willingness_to_pay", label: "Willingness to pay", completed: false, completed_at: null, auto_completed: false },
      { stage: "channel", label: "Channel", completed: false, completed_at: null, auto_completed: false },
      { stage: "competition_moat", label: "Competition & moat", completed: false, completed_at: null, auto_completed: false },
    ],
  },
  confidence: { chips: [{ dimension: "demand", label: "unknown", drivers: ["No interviews yet"] }] },
  readiness: {
    level: "speculative",
    can_run_judges: false,
    checks: [{ name: "evidence", passed: false, detail: "Need stronger problem evidence" }],
  },
  active_experiment: null,
  top_assumptions: [],
};

export const MOCK_OVERVIEW_READY: ValidationOverview = {
  ...MOCK_OVERVIEW,
  readiness: {
    level: "ready",
    can_run_judges: true,
    checks: [
      { name: "worksheet", passed: true, detail: null },
      { name: "evidence", passed: true, detail: null },
    ],
  },
};

export const MOCK_OVERVIEW_BLOCKED: ValidationOverview = {
  ...MOCK_OVERVIEW,
  readiness: {
    level: "speculative",
    can_run_judges: false,
    checks: [
      { name: "worksheet", passed: true, detail: "Worksheet complete" },
      { name: "evidence", passed: false, detail: "Need problem evidence" },
    ],
  },
};

export const MOCK_ASSUMPTIONS: Assumption[] = [
  {
    id: "a1",
    workspace_id: "ws-demo",
    statement: "Clinics will pay $200/mo for scheduling automation",
    type: "demand",
    status: "untested",
    confidence: 0.3,
    disconfirming_criteria: null,
    worksheet_version_id: null,
    sort_order: 0,
  },
  {
    id: "a2",
    workspace_id: "ws-demo",
    statement: "Compliance leads rank audit prep in top-three pains",
    type: "demand",
    status: "testing",
    confidence: 0.5,
    disconfirming_criteria: "Fewer than 3 of 5 confirm unprompted",
    worksheet_version_id: null,
    sort_order: 1,
  },
  {
    id: "a3",
    workspace_id: "ws-demo",
    statement: "Incumbent tools lack compliance-specific workflows",
    type: "competition",
    status: "supported",
    confidence: 0.7,
    disconfirming_criteria: null,
    worksheet_version_id: null,
    sort_order: 2,
  },
];

export const MOCK_WORKSPACE_EXPERIMENTS: Experiment[] = [
  {
    id: "e1",
    workspace_id: "ws-demo",
    title: "5 clinic interviews",
    hypothesis: "At least 3 of 5 will confirm scheduling pain.",
    assumption_id: null,
    method: null,
    target: null,
    pass_fail_threshold: "3/5 confirm pain",
    start_date: null,
    due_date: null,
    result: null,
    decision: "",
    status: "planned",
    worksheet_version_id: null,
  },
  {
    id: "e2",
    workspace_id: "ws-demo",
    title: "Landing page smoke test",
    hypothesis: "5% signup rate from compliance leads.",
    assumption_id: null,
    method: null,
    target: null,
    pass_fail_threshold: "≥5% signup",
    start_date: null,
    due_date: null,
    result: "42 visitors, 3 signups",
    decision: "iterate",
    status: "completed",
    worksheet_version_id: null,
  },
];

export const MOCK_EVIDENCE = [
  {
    id: "ev1",
    workspace_id: "ws-demo",
    type: "founder_note" as const,
    strength: "weak" as const,
    source: "Interview",
    content: "3 founders said validation is ad hoc.",
    occurred_at: null,
    assumption_ids: [],
    experiment_id: null,
    worksheet_version_id: null,
  },
];

export const MOCK_INTERVIEWS = [
  {
    id: "i1",
    workspace_id: "ws-demo",
    person_label: "Alex (clinic admin)",
    segment: null,
    occurred_at: "2026-06-01",
    context: null,
    notes: "Spends 2h/week on manual scheduling.",
    quotes: [],
    workaround: null,
    pain_cost: null,
    objections: null,
    assumption_ids: [],
    ai_summary: null,
  },
];

export const MOCK_HANDOFF_ITEMS = [
  {
    kind: "assumption" as const,
    title: "Clinics have budget for scheduling tools",
    detail: "Validate willingness to pay before building workflow depth.",
    source_judge: "vc" as const,
  },
  {
    kind: "evidence_target" as const,
    title: "Run 5 buyer interviews",
    detail: "Validate urgency with compliance leads.",
    source_judge: "customer" as const,
  },
  {
    kind: "experiment" as const,
    title: "Landing page smoke test",
    detail: "Measure signup rate from target segment.",
    source_judge: "pm" as const,
  },
];

export const MOCK_STARTUP_WORKSPACE: StartupWorkspace = {
  workspaceId: "root-1",
  displayName: "AI scheduling for clinics",
  versionCount: 2,
  currentScore: 5.1,
  latestDelta: 0.9,
  latestRunId: "child-2",
  latestStatus: "completed",
  lineage: [
    {
      run_id: "root-1",
      status: "completed",
      idea_preview: "AI scheduling for clinics",
      created_at: "2026-01-01T12:00:00Z",
      version: 1,
      parent_run_id: null,
      verdict_summary: { pass: 1, fail: 2, conditional: 2, avg_score: 4.2 },
    },
    {
      run_id: "child-2",
      status: "completed",
      idea_preview: "AI scheduling for clinics v2",
      created_at: "2026-01-02T12:00:00Z",
      version: 2,
      parent_run_id: "root-1",
      verdict_summary: { pass: 2, fail: 1, conditional: 2, avg_score: 5.1 },
    },
  ],
};

export const MOCK_STARTUP_WORKSPACE_EXPANDED: StartupWorkspace = {
  ...MOCK_STARTUP_WORKSPACE,
  versionCount: 4,
  lineage: [
    ...MOCK_STARTUP_WORKSPACE.lineage,
    {
      run_id: "child-3",
      status: "completed",
      idea_preview: "AI scheduling v3 — compliance wedge",
      created_at: "2026-03-01T12:00:00Z",
      version: 3,
      parent_run_id: "child-2",
      verdict_summary: { pass: 2, fail: 1, conditional: 2, avg_score: 5.4 },
    },
    {
      run_id: "child-4",
      status: "completed",
      idea_preview: "AI scheduling v4 — buyer proof",
      created_at: "2026-05-01T12:00:00Z",
      version: 4,
      parent_run_id: "child-3",
      verdict_summary: { pass: 3, fail: 0, conditional: 2, avg_score: 6.1 },
    },
  ],
};

export const MOCK_APPEAL: AppealResult = {
  appealText: "We ran 5 interviews; 4 confirmed scheduling pain and 2 signed LOIs.",
  targetJudges: ["customer", "vc"],
  originalByJudge: Object.fromEntries(
    JUDGE_ORDER.map((judge) => [
      judge,
      mockVerdict(judge, judge === "customer" ? { score: 4, verdict: "FAIL" } : judge === "vc" ? { score: 3, verdict: "FAIL" } : {}),
    ]),
  ) as Record<(typeof JUDGE_ORDER)[number], Verdict>,
  revisedByJudge: Object.fromEntries(
    JUDGE_ORDER.map((judge) => [
      judge,
      mockVerdict(
        judge,
        judge === "customer" || judge === "vc"
          ? { score: judge === "customer" ? 6 : 5, verdict: "CONDITIONAL" }
          : { score: 5, verdict: "CONDITIONAL" },
      ),
    ]),
  ) as Record<(typeof JUDGE_ORDER)[number], Verdict>,
  revisedSynthesis: "**Recommendation:** ITERATE\n\n**Confidence:** Medium",
  evidenceOutcomes: [
    {
      judge: "customer",
      evidenceAsk: "Paid pilot LOI",
      outcome: "Evidence met",
      targeted: true,
      scoreDelta: 2,
    },
  ],
};

export const MOCK_LATEST_IMPROVEMENT: LatestImprovement = {
  kind: "version",
  summary: "Customer score moved after sharper ICP and buyer proof.",
  scoreBefore: 4.2,
  scoreAfter: 5.1,
  scoreDelta: 0.9,
};

export function partialRadarState() {
  const state = initialRunState();
  state.judges.vc = {
    status: "revealed",
    verdict: mockVerdict("vc", { verdict: "FAIL", score: 4 }),
  };
  state.judges.engineer = {
    status: "revealed",
    verdict: mockVerdict("engineer", { verdict: "CONDITIONAL", score: 6 }),
  };
  return state;
}
