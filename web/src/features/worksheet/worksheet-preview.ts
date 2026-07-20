/** Client-side preview matching backend compose_generated_document template. */
import { displayWorksheetField, type WorksheetValues } from "./worksheet-schema";

export function composeWorksheetPreview(worksheet: WorksheetValues): string {
  const competitors = worksheet.competitors ?? [];

  const competitors_text =
    competitors.length > 0
      ? competitors.map((c) => `- ${c}`).join("\n")
      : "None listed";

  const lines = [
    `Working name: ${displayWorksheetField(worksheet.working_name)}`,
    "",
    `Problem: I believe that ${displayWorksheetField(worksheet.audience)} ${displayWorksheetField(worksheet.problem_statement)}`,
    "",
    `Current workaround: ${displayWorksheetField(worksheet.current_workaround)}`,
    "",
    `Solution: ${displayWorksheetField(worksheet.solution_statement)}`,
    "",
    `Secret sauce: ${displayWorksheetField(worksheet.secret_sauce)}`,
    "",
    `Pricing hypothesis: ${displayWorksheetField(worksheet.pricing_hypothesis)}`,
    "",
    `Existing evidence: ${displayWorksheetField(worksheet.existing_evidence)}`,
    "",
    `Competitors and alternatives:\n${competitors_text}`,
    "",
    `Top risky assumption: ${displayWorksheetField(worksheet.top_risky_assumption)}`,
    "",
    `Disconfirming evidence: ${displayWorksheetField(worksheet.disconfirming_evidence)}`,
  ];

  if (worksheet.trigger_event?.trim()) {
    lines.push("", `Trigger event: ${worksheet.trigger_event}`);
  }

  return lines.join("\n");
}
