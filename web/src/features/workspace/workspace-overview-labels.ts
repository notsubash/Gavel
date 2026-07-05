export const LIFECYCLE_LABEL: Record<string, string> = {
  draft: "Draft",
  discovery: "Discovery",
  testing: "Testing",
  evidence_ready: "Evidence ready",
  judged: "Judged",
  iterating: "Iterating",
};

export const READINESS_LABEL: Record<string, string> = {
  too_vague: "Too vague",
  speculative: "Speculative",
  ready: "Ready for judges",
};

export const OVERVIEW_FALLBACK_NEXT_ACTION =
  "Open validation and log evidence against your riskiest assumptions.";
