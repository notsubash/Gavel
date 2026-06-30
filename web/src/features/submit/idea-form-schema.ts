import { z } from "zod";

export const ideaFormSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(10, "At least 10 characters — give the judges something to work with.")
    .max(8000, "Keep it under 8,000 characters."),
  target_customer: z.string().optional(),
  pricing: z.string().optional(),
  traction: z.string().optional(),
  competitorsText: z.string().optional(),
});

export type IdeaFormValues = z.infer<typeof ideaFormSchema>;

export const ideaFormDefaults: IdeaFormValues = {
  idea: "",
  target_customer: "",
  pricing: "",
  traction: "",
  competitorsText: "",
};

export const IDEA_MAX_LENGTH = 8000;
