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
  },
  {
    name: "pricing_hypothesis",
    label: "Pricing hypothesis",
    prompt: "How might this make money, and what price would you test first?",
    example: "$19 to $49 one-time self-hosted license, or bring-your-own-key.",
    multiline: true,
  },
  {
    name: "existing_evidence",
    label: "Existing evidence",
    prompt: 'What proof do you have today? It is fine to write "none yet."',
    example: "Three founders asked for a validation template. No paid signal yet.",
    multiline: true,
  },
  {
    name: "competitors",
    label: "Competitors and alternatives",
    prompt: "What else do people use instead? Include doing nothing.",
    example: "ChatGPT, Notion templates, Spreadsheets, Doing nothing",
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
  },
];
