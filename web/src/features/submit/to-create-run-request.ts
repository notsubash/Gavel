import type { CreateRunRequest } from "@/lib/api/types-helpers";
import type { AdvancedSettings } from "@/lib/settings/advanced-settings";

import type { IdeaFormValues } from "./idea-form-schema";

export function toCreateRunRequest(
  values: IdeaFormValues,
  runtime: Pick<
    AdvancedSettings,
    "model_runtime" | "max_debate_rounds" | "enable_web_search"
  >,
): CreateRunRequest {
  const competitors = (values.competitorsText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const request: CreateRunRequest = {
    idea: values.idea.trim(),
    model_runtime: runtime.model_runtime,
    execution_flow: "deterministic",
    max_debate_rounds: runtime.max_debate_rounds,
    enable_web_search: runtime.enable_web_search,
  };

  const targetCustomer = values.target_customer?.trim();
  const pricing = values.pricing?.trim();
  const traction = values.traction?.trim();

  if (targetCustomer) request.target_customer = targetCustomer;
  if (pricing) request.pricing = pricing;
  if (traction) request.traction = traction;
  if (competitors.length > 0) request.competitors = competitors;

  return request;
}
