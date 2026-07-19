import { z } from "zod";

export const worksheetSchema = z.object({
  working_name: z.string().min(1, "Required").max(120),
  audience: z.string().min(10, "At least 10 characters").max(2000),
  problem_statement: z.string().min(10, "At least 10 characters").max(4000),
  current_workaround: z.string().min(10, "At least 10 characters").max(4000),
  solution_statement: z.string().min(10, "At least 10 characters").max(4000),
  secret_sauce: z.string().min(10, "At least 10 characters").max(2000),
  pricing_hypothesis: z.string().max(2000),
  existing_evidence: z.string().max(4000),
  competitors: z.array(z.string()).max(20),
  top_risky_assumption: z.string().min(10, "At least 10 characters").max(1000),
  disconfirming_evidence: z.string().min(10, "At least 10 characters").max(2000),
  trigger_event: z.string().max(1000).optional().nullable(),
});

/** Create flow: deferred detail fields may be empty; filled with placeholders on save. */
export const createWorksheetSchema = worksheetSchema
  .omit({
    current_workaround: true,
    secret_sauce: true,
    disconfirming_evidence: true,
  })
  .extend({
    current_workaround: z.string().max(4000),
    secret_sauce: z.string().max(2000),
    disconfirming_evidence: z.string().max(2000),
  });

export type WorksheetValues = z.infer<typeof worksheetSchema>;

export const worksheetDefaults: WorksheetValues = {
  working_name: "",
  audience: "",
  problem_statement: "",
  current_workaround: "",
  solution_statement: "",
  secret_sauce: "",
  pricing_hypothesis: "unknown",
  existing_evidence: "none yet",
  competitors: [],
  top_risky_assumption: "",
  disconfirming_evidence: "",
  trigger_event: null,
};

/** Coerce API/partial payloads into valid form values (e.g. missing competitors). */
export function normalizeWorksheetValues(raw: Partial<WorksheetValues>): WorksheetValues {
  return {
    ...worksheetDefaults,
    ...raw,
    competitors: Array.isArray(raw.competitors) ? raw.competitors : [],
  };
}

export type WorksheetFieldName = keyof WorksheetValues;

/** Phase 3 create: ask these first; everything else is “Add more detail”. */
export const CREATE_CORE_FIELD_NAMES = [
  "working_name",
  "audience",
  "problem_statement",
  "solution_statement",
  "top_risky_assumption",
] as const satisfies readonly WorksheetFieldName[];

export type CreateCoreFieldName = (typeof CREATE_CORE_FIELD_NAMES)[number];

/** Backend still requires these; fill on save if the founder skipped detail. */
export const DEFERRED_FIELD_PLACEHOLDERS: Partial<Record<WorksheetFieldName, string>> = {
  current_workaround: "Not captured yet.",
  secret_sauce: "Not captured yet.",
  disconfirming_evidence: "Not captured yet.",
};

const BACKEND_MIN_DEFERRED = 10;

export function isCreateCoreField(name: WorksheetFieldName): boolean {
  return (CREATE_CORE_FIELD_NAMES as readonly string[]).includes(name);
}

function needsDeferredPlaceholder(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (/^not captured yet\.?$/i.test(text)) return true;
  return text.length < BACKEND_MIN_DEFERRED;
}

/** Fill empty/short deferred required fields so create/Pitch can save without the full wall. */
export function fillDeferredPlaceholders(data: WorksheetValues): WorksheetValues {
  const next: WorksheetValues = {
    ...data,
    competitors: Array.isArray(data.competitors) ? data.competitors : [],
  };
  for (const [key, placeholder] of Object.entries(DEFERRED_FIELD_PLACEHOLDERS)) {
    const name = key as WorksheetFieldName;
    const value = next[name];
    if (typeof value === "string" && placeholder && needsDeferredPlaceholder(value)) {
      (next as Record<string, unknown>)[name] = placeholder;
    }
  }
  if (!next.pricing_hypothesis.trim()) next.pricing_hypothesis = "unknown";
  if (!next.existing_evidence.trim()) next.existing_evidence = "none yet";
  return next;
}

/** Clear create stubs so Pitch shows empty deferred fields instead of placeholder prose. */
export function stripDeferredPlaceholders(data: WorksheetValues): WorksheetValues {
  const next: WorksheetValues = {
    ...data,
    competitors: Array.isArray(data.competitors) ? data.competitors : [],
  };
  for (const [key, placeholder] of Object.entries(DEFERRED_FIELD_PLACEHOLDERS)) {
    const name = key as WorksheetFieldName;
    const value = next[name];
    if (typeof value === "string" && placeholder && /^not captured yet\.?$/i.test(value.trim())) {
      (next as Record<string, unknown>)[name] = "";
    }
  }
  return next;
}

/** Preview/display: hide create stubs as ellipsis. */
export function displayWorksheetField(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "…";
  if (/^(not captured yet\.?|none yet\.?|unknown)$/i.test(text)) return "…";
  return text;
}

export function countFilledWorksheetFields(values: WorksheetValues): number {
  let filled = 0;
  for (const name of CREATE_CORE_FIELD_NAMES) {
    const value = values[name];
    if (typeof value === "string" && value.trim()) filled += 1;
    else if (Array.isArray(value) && value.length > 0) filled += 1;
  }
  return filled;
}

/** ponytail: short/stub text = weak; upgrade path = quality model score. */
export function isWeakFieldValue(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/^(not captured yet\.?|none yet\.?|unknown)$/i.test(text)) return true;
  return text.length < 80;
}

export const WORKSHEET_FIELDS: {
  name: WorksheetFieldName;
  label: string;
  prompt: string;
  example: string;
  multiline?: boolean;
  optional?: boolean;
}[] = [
  {
    name: "working_name",
    label: "Working name",
    prompt: "What should we call this idea for now?",
    example: "Validation OS for Solo Founders",
  },
  {
    name: "audience",
    label: "Audience",
    prompt: "Who has this problem? Be narrower than feels comfortable.",
    example: "Solo technical founders building paid SaaS before they have revenue.",
    multiline: true,
  },
  {
    name: "problem_statement",
    label: "Problem statement",
    prompt:
      "Describe the specific problem only. The preview adds “I believe that [audience] …” automatically.",
    example: "have trouble proving buyer demand before they build.",
    multiline: true,
  },
  {
    name: "current_workaround",
    label: "Current workaround",
    prompt: "How do they solve this today, even badly?",
    example:
      "They use Notion docs, ChatGPT, Reddit searches, informal founder calls, spreadsheets, or they skip validation entirely.",
    multiline: true,
    optional: true,
  },
  {
    name: "solution_statement",
    label: "Solution statement",
    prompt: "I am developing [offering] to help [audience] with [problem].",
    example:
      "I am developing a local-first founder workbench to help solo founders turn startup ideas into validation experiments, evidence, and judge critiques.",
    multiline: true,
  },
  {
    name: "secret_sauce",
    label: "Secret sauce",
    prompt: "What makes your approach meaningfully different?",
    example:
      "Five harsh AI judges plus a persistent evidence ledger that gets stricter as the founder adds real-world proof.",
    multiline: true,
    optional: true,
  },
  {
    name: "pricing_hypothesis",
    label: "Pricing hypothesis",
    prompt: "How might this make money, and what price would you test first?",
    example: "$19 to $49 one-time self-hosted license, or bring-your-own-key.",
    multiline: true,
    optional: true,
  },
  {
    name: "existing_evidence",
    label: "Existing evidence",
    prompt: 'What proof do you have today? It is fine to write "none yet."',
    example: "Three founders asked for a validation template. No paid signal yet.",
    multiline: true,
    optional: true,
  },
  {
    name: "competitors",
    label: "Competitors and alternatives",
    prompt:
      "Short summary of alternatives (include doing nothing). On Case, Scan competitors logs research as evidence linked to this list.",
    example: "ChatGPT, Notion templates, Spreadsheets, Doing nothing",
    optional: true,
  },
  {
    name: "top_risky_assumption",
    label: "Top risky assumption",
    prompt: "What must be true for this idea to work?",
    example:
      "Solo founders will return weekly to update validation evidence before asking for another roast.",
    multiline: true,
  },
  {
    name: "disconfirming_evidence",
    label: "What would prove this wrong?",
    prompt: "What evidence would make you seriously change or kill the idea?",
    example:
      "Five target founders say they already get enough value from ChatGPT plus Notion and would not track validation in a separate tool.",
    multiline: true,
    optional: true,
  },
];

export const CREATE_CORE_FIELDS = WORKSHEET_FIELDS.filter((field) =>
  isCreateCoreField(field.name),
);
export const DETAIL_FIELDS = WORKSHEET_FIELDS.filter((field) => !isCreateCoreField(field.name));
