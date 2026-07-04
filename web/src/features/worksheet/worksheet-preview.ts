/** Client-side preview matching backend compose_generated_document template. */
import type { WorksheetValues } from "./worksheet-schema";

export function composeWorksheetPreview(worksheet: WorksheetValues): string {
  const competitors =
    worksheet.competitors.length > 0
      ? worksheet.competitors.map((c) => `- ${c}`).join("\n")
      : "None listed";

  const lines = [
    `Working name: ${worksheet.working_name || "…"}`,
    "",
    `Problem: I believe that ${worksheet.audience || "…"} ${worksheet.problem_statement || "…"}`,
    "",
    `Current workaround: ${worksheet.current_workaround || "…"}`,
    "",
    `Solution: ${worksheet.solution_statement || "…"}`,
    "",
    `Secret sauce: ${worksheet.secret_sauce || "…"}`,
    "",
    `Pricing hypothesis: ${worksheet.pricing_hypothesis || "…"}`,
    "",
    `Existing evidence: ${worksheet.existing_evidence || "…"}`,
    "",
    `Competitors and alternatives:\n${competitors}`,
    "",
    `Top risky assumption: ${worksheet.top_risky_assumption || "…"}`,
    "",
    `Disconfirming evidence: ${worksheet.disconfirming_evidence || "…"}`,
  ];

  if (worksheet.trigger_event?.trim()) {
    lines.push("", `Trigger event: ${worksheet.trigger_event}`);
  }

  return lines.join("\n");
}
