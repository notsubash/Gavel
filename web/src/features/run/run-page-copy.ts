/**
 * Run page copy (Phase 1 vocabulary).
 *
 * Primary buttons only: Start review · Submit evidence · Revise pitch.
 * One primary action per completed-run fork (from GO / ITERATE / NO-GO).
 */

export const RUN_PAGE_COPY = {
  reviewEyebrow: "Review",
  overallDecision: "Overall decision",
  topProblems: "Top problems",
  highestPriority: "Highest priority",
  recommendedExperiment: "Recommended experiment",
  experimentAudience: "Audience",
  experimentEffort: "Estimated effort",
  experimentQuestions: "Questions to answer",
  experimentHypothesis: "What you're testing",
  todaysGoal: "Today's goal",
  presentEvidence: "Present evidence",
  presentEvidenceLead: "Completed your experiment? Share results to update this review.",
  /** @deprecated Prefer submitEvidence for primary CTAs */
  completeExperiment: "Submit evidence",
  submitEvidence: "Submit evidence",
  evidenceStatusLoading: "Checking evidence status…",
  viewEvidenceResult: "View evidence result",
  judgePanel: "Judge detail",
  debateConsequence: "What the debate changed",
  debateConsequenceLead:
    "The sharpest split, score shifts after argument, and what still blocks a clear go.",
  debateDisagreement: "Point of disagreement",
  debateWhatMoved: "What moved",
  debateNoMovement: "No judge changed their score after hearing the full debate.",
  debateUnresolvedRisk: "Unresolved risk",
  judgeBeforeDebate: "Before debate",
  judgeFullRead: "Full read",
  judgeProofNeeded: "Proof needed",
  debateTranscript: "Debate transcript",
  reviewComplete: "Review complete",
  reviewNotFound: "This review does not exist or the link is wrong.",
  submitIdea: "Review an idea",
  /** @deprecated Prefer revisePitch */
  refineIdea: "Revise pitch",
  revisePitch: "Revise pitch",
  openReview: "Open review",
  startReview: "Start review",
  submitAnother: "Review another idea",
  shareExportMenu: "Share / export…",
  phaseReviewing: "The panel is reviewing your idea",
  reviewCancelled: "You stopped this review before it finished.",
  stopReviewTitle: "Stop this review?",
  stopReviewDescription: "The judges will halt between turns. You can always submit a new idea.",
  contextSummary: "Related reviews, sources, metrics",
  latestImprovement: "Latest improvement",
  sseReconnecting: "Connection interrupted — reconnecting to the live review…",
  sseReconnected: "Live connection restored.",
  metricsTableScrollHint: "Scroll horizontally for the full metrics table.",
} as const;

export const HOME_COPY = {
  eyebrow: "Startup iteration review",
  headline: "Five AI judges review your startup idea, debate it, and recommend your next step.",
  lead: "Submit your pitch. Watch five distinct critics score, challenge, and argue in real time.",
} as const;

export const SETTINGS_COPY = {
  intro:
    "Defaults for new Gavel reviews. Stored in this browser only — founders can ignore this page and use the simple submit flow on",
  newReviewDefaults: "New review defaults",
  newReviewDescription:
    "Applied every time you submit or refine an idea. The submit form no longer shows these controls.",
  webSearchLabel: "Enable web search for new reviews",
} as const;

export const HISTORY_COPY = {
  eyebrow: "Gavel",
  title: "Ideas you've put on trial",
  description:
    "Each row is one idea in Gavel — versions, score, movement, and your open next action.",
  emptyTitle: "No trials yet",
  emptyDescription: "Roast your first idea in Gavel — it shows up here when a review finishes.",
  versionCount: (count: number) => `${count} ${count === 1 ? "version" : "versions"}`,
  currentScore: "Score",
  latestDelta: "Delta",
  openNextAction: "Next action",
  nextActionOpenReview: "Open review",
  nextActionViewFailed: "View failed review",
  nextActionViewCancelled: "View cancelled review",
  olderVersions: (count: number) =>
    `${count} older version${count === 1 ? "" : "s"}`,
} as const;

export const VERSION_COPY = {
  comparisonTitle: "What changed since last version",
  comparisonLead: (version: number, chainNote: string) =>
    `Comparing v${version} to the prior version${chainNote}.`,
  scoreDeltaReason: "Summary",
  removed: "Removed",
  added: "Added",
  changed: "Changed",
  evidenceAdded: "Evidence noted",
  noPriorVersion:
    "No prior version to compare yet. Refine this idea after you update the pitch to see what changed.",
  confidenceTitle: "Confidence by dimension",
  confidenceWhy: "See why",
  confidenceNextAction: "Raise weakest dimension",
} as const;

export const EVIDENCE_COPY = {
  modalTitle: "Submit evidence",
  modalLead:
    "Tell the panel what you learned running this experiment. We route your update to the judges most tied to your top blocker.",
  modalSubmit: "Submit evidence",
  experimentFocus: "Your experiment:",
  experimentHypothesis: "Hypothesis:",
  changedAssumptionLabel: "Key assumption that changed",
  changedAssumptionPlaceholder:
    "We assumed power users would look at key labels — interviews showed they rely on muscle memory instead.",
  artifactLinksLabel: "Links or artifacts",
  artifactLinksPlaceholder:
    "Paste one URL per line (interview notes, Loom demo, spreadsheet, pre-order page…)",
  artifactLinksHint: "Optional — http and https links only.",
  autoTargetJudges: "Auto-selected judges",
  evidenceAsk: "Needs to hear:",
  attachmentsLabel: "Supporting notes",
  attachmentsPlaceholder: "File uploads coming soon — paste links or summaries in the text field for now.",
  evidenceLabel: "What happened?",
  evidencePlaceholder:
    "We completed two validation studies, signed LOIs with pilot customers, and filed a provisional patent…",
  submitting: "Submitting evidence — the panel is revising their verdicts.",
  submitFailed: "Evidence submission failed",
  submitFailedDetail: "Could not submit evidence.",
  resultTitle: "Evidence result",
  resultLead:
    "Updated verdicts after your evidence. Outcome badges show whether each judge's ask was met.",
  progressTitle: "Progress update",
  panelScore: "Panel score",
  confidence: "Overall confidence",
  confidenceDimensions: "Confidence by dimension",
  confidenceUnchanged: "Dimension confidence unchanged after this evidence.",
  yourEvidence: "Your evidence:",
  minLengthError: (min: number) => `Evidence must be at least ${min} characters.`,
  maxLengthError: (max: number) => `Evidence must be at most ${max} characters.`,
} as const;
