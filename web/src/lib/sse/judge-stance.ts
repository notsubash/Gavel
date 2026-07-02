import type { VerdictLabel } from "./types";

const STANCE_LABEL: Record<VerdictLabel, string> = {
  PASS: "Bullish",
  CONDITIONAL: "Cautious",
  FAIL: "Skeptical",
};

export function judgeStanceLabel(verdict: VerdictLabel): string {
  return STANCE_LABEL[verdict];
}

export const STANCE_CLASS: Record<VerdictLabel, string> = {
  PASS: "border-pass/40 bg-pass/5 text-pass",
  CONDITIONAL: "border-conditional/40 bg-conditional/5 text-conditional",
  FAIL: "border-fail/40 bg-fail/5 text-fail",
};
