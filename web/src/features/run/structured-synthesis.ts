export type OverallRecommendation = "GO" | "ITERATE" | "NO-GO";
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface RecommendedExperiment {
  title: string;
  audience: string;
  hypothesis: string;
  questions: string[];
  effort_minutes: number;
}

export interface StructuredSynthesis {
  overall_recommendation: OverallRecommendation;
  confidence: ConfidenceLevel;
  top_strengths: string[];
  top_risks: string[];
  top_problems: string[];
  highest_priority?: string | null;
  biggest_disagreement: string;
  recommended_experiment: RecommendedExperiment | null;
}

const RECOMMENDATIONS: OverallRecommendation[] = ["GO", "ITERATE", "NO-GO"];
const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["LOW", "MEDIUM", "HIGH"];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseRecommendedExperiment(raw: unknown): RecommendedExperiment | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const audience = typeof data.audience === "string" ? data.audience.trim() : "";
  const hypothesis = typeof data.hypothesis === "string" ? data.hypothesis.trim() : "";
  const effort = data.effort_minutes;
  const questions = asStringArray(data.questions);
  if (!title || !audience || !hypothesis || typeof effort !== "number" || questions.length < 3) {
    return null;
  }
  return {
    title,
    audience,
    hypothesis,
    questions: questions.slice(0, 5),
    effort_minutes: Math.min(2880, Math.max(15, Math.round(effort))),
  };
}

export function parseStructuredSynthesis(raw: unknown): StructuredSynthesis | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const recommendation = data.overall_recommendation;
  const confidence = data.confidence;
  const disagreement = data.biggest_disagreement;
  if (
    typeof recommendation !== "string" ||
    !RECOMMENDATIONS.includes(recommendation as OverallRecommendation) ||
    typeof confidence !== "string" ||
    !CONFIDENCE_LEVELS.includes(confidence as ConfidenceLevel) ||
    typeof disagreement !== "string" ||
    !disagreement.trim()
  ) {
    return null;
  }
  return {
    overall_recommendation: recommendation as OverallRecommendation,
    confidence: confidence as ConfidenceLevel,
    top_strengths: asStringArray(data.top_strengths),
    top_risks: asStringArray(data.top_risks),
    top_problems: asStringArray(data.top_problems),
    highest_priority:
      typeof data.highest_priority === "string" && data.highest_priority.trim()
        ? data.highest_priority.trim()
        : null,
    biggest_disagreement: disagreement.trim(),
    recommended_experiment: parseRecommendedExperiment(data.recommended_experiment),
  };
}

/** Parse moderator prose emitted by synthesis_to_prose when structured JSON is unavailable. */
export function parseDecisionVerdictProse(content: string): StructuredSynthesis | null {
  const chunks = content
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (chunks.length === 0) return null;

  let recommendation: OverallRecommendation | null = null;
  let confidence: ConfidenceLevel | null = null;
  const top_strengths: string[] = [];
  const top_risks: string[] = [];
  let highest_priority: string | null = null;
  let biggest_disagreement = "";

  for (const chunk of chunks) {
    const headerMatch = chunk.match(/^\*\*([^*]+):\*\*\s*([\s\S]*)$/);
    if (!headerMatch) continue;
    const label = headerMatch[1].trim().toLowerCase();
    const body = headerMatch[2].trim();

    if (label === "recommendation") {
      const upper = body.toUpperCase();
      recommendation = RECOMMENDATIONS.find((item) => upper.includes(item)) ?? null;
      continue;
    }
    if (label === "confidence") {
      const upper = body.toUpperCase();
      confidence = CONFIDENCE_LEVELS.find((item) => upper.includes(item)) ?? null;
      continue;
    }
    if (label === "strengths") {
      top_strengths.push(...body.split("\n").map((line) => line.replace(/^[-•]\s*/, "").trim()).filter(Boolean));
      continue;
    }
    if (label === "top risks") {
      top_risks.push(...body.split("\n").map((line) => line.replace(/^[-•]\s*/, "").trim()).filter(Boolean));
      continue;
    }
    if (label === "highest priority") {
      highest_priority = body;
      continue;
    }
    if (label === "biggest disagreement") {
      biggest_disagreement = body;
    }
  }

  if (!recommendation || !confidence || !biggest_disagreement) return null;
  return {
    overall_recommendation: recommendation,
    confidence,
    top_strengths,
    top_risks,
    top_problems: [],
    highest_priority,
    biggest_disagreement,
    recommended_experiment: null,
  };
}

/** Judge key concerns ranked FAIL → CONDITIONAL → PASS, lowest score first. */
export function collectKeyConcerns(
  verdicts: Array<{ verdict: string; score: number; key_concern?: string | null }>,
  limit = 3,
): string[] {
  const rank: Record<string, number> = { FAIL: 0, CONDITIONAL: 1, PASS: 2 };
  const seen = new Set<string>();
  const concerns: string[] = [];
  for (const verdict of [...verdicts].sort((left, right) => {
    const rankLeft = rank[left.verdict] ?? 9;
    const rankRight = rank[right.verdict] ?? 9;
    if (rankLeft !== rankRight) return rankLeft - rankRight;
    return left.score - right.score;
  })) {
    const concern = verdict.key_concern?.trim();
    if (!concern) continue;
    const key = concern.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    concerns.push(concern);
    if (concerns.length >= limit) break;
  }
  return concerns;
}

export function topPriorities(
  synthesis: StructuredSynthesis,
  fixes: string[],
  keyConcerns: string[] = [],
  limit = 3,
): string[] {
  if (synthesis.top_problems.length > 0) {
    return synthesis.top_problems.slice(0, limit);
  }

  const seen = new Set<string>();
  const problems: string[] = [];

  for (const risk of synthesis.top_risks) {
    const key = risk.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push(risk);
    if (problems.length >= limit) break;
  }

  for (const concern of keyConcerns) {
    if (problems.length >= limit) break;
    const key = concern.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push(concern);
  }

  if (problems.length >= limit) return problems.slice(0, limit);
  return [...problems, ...fixesToPriorities(fixes, limit - problems.length)].slice(0, limit);
}

function fixesToPriorities(fixes: string[], limit: number): string[] {
  const seen = new Set<string>();
  const priorities: string[] = [];
  for (const fix of fixes) {
    const trimmed = fix.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    priorities.push(trimmed);
    if (priorities.length >= limit) break;
  }
  return priorities;
}

/** Judge fixes ranked FAIL → CONDITIONAL → PASS, lowest score first within tier. */
export function collectRecommendedFixes(
  verdicts: Array<{ verdict: string; score: number; recommended_fix?: string | null }>,
): string[] {
  const rank: Record<string, number> = { FAIL: 0, CONDITIONAL: 1, PASS: 2 };
  return [...verdicts]
    .sort((a, b) => {
      const rankA = rank[a.verdict] ?? 9;
      const rankB = rank[b.verdict] ?? 9;
      if (rankA !== rankB) return rankA - rankB;
      return a.score - b.score;
    })
    .map((verdict) => verdict.recommended_fix?.trim())
    .filter((fix): fix is string => Boolean(fix));
}

const NEXT_ACTION_SLOTS = 3;

/** Top founder problems — prefers moderator structured output. */
export function deriveNextActions(
  synthesisProse: string | null,
  structuredSynthesis: unknown,
  verdicts: Array<{ verdict: string; score: number; recommended_fix?: string | null; key_concern?: string | null }>,
  limit = NEXT_ACTION_SLOTS,
): string[] {
  const structured =
    parseStructuredSynthesis(structuredSynthesis) ??
    (synthesisProse ? parseDecisionVerdictProse(synthesisProse) : null);
  if (structured) {
    return topPriorities(
      structured,
      collectRecommendedFixes(verdicts),
      collectKeyConcerns(verdicts, limit),
      limit,
    );
  }
  const concerns = collectKeyConcerns(verdicts, limit);
  if (concerns.length > 0) return concerns;
  return fixesToPriorities(collectRecommendedFixes(verdicts), limit);
}

export interface WorkflowBrief {
  problems: string[];
  blocker: string | null;
}

function normalizeBriefText(text: string): string {
  return text.trim().toLowerCase();
}

/** Founder-facing top blocker — never the inter-judge disagreement line. */
export function deriveHighestPriority(
  structured: StructuredSynthesis | null,
  problems: string[],
): string | null {
  const disagreement = structured?.biggest_disagreement?.trim();
  const disagreementKey = disagreement ? normalizeBriefText(disagreement) : "";
  const firstProblem = problems[0]?.trim();
  const firstProblemKey = firstProblem ? normalizeBriefText(firstProblem) : "";

  const explicit = structured?.highest_priority?.trim();
  if (explicit) {
    const explicitKey = normalizeBriefText(explicit);
    if (disagreementKey && explicitKey === disagreementKey) {
      return null;
    }
    if (firstProblemKey && explicitKey === firstProblemKey) return null;
    return explicit;
  }

  return null;
}

export function deriveWorkflowBrief(
  synthesisProse: string | null,
  structuredSynthesis: unknown,
  verdicts: Array<{ verdict: string; score: number; recommended_fix?: string | null; key_concern?: string | null }>,
): WorkflowBrief {
  const problems = deriveNextActions(synthesisProse, structuredSynthesis, verdicts);
  const structured =
    parseStructuredSynthesis(structuredSynthesis) ??
    (synthesisProse ? parseDecisionVerdictProse(synthesisProse) : null);
  const blocker = deriveHighestPriority(structured, problems);
  return { problems, blocker };
}

export { NEXT_ACTION_SLOTS };
