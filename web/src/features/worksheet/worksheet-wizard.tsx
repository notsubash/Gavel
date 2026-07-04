"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { composeWorksheetPreview } from "@/features/worksheet/worksheet-preview";
import {
  WORKSHEET_FIELDS,
  worksheetDefaults,
  worksheetSchema,
  type WorksheetFieldName,
  type WorksheetValues,
} from "@/features/worksheet/worksheet-schema";
import { ApiError } from "@/lib/api/client";
import {
  clarifyField,
  createWorkspace,
  draftFromNotes,
} from "@/lib/api/workspaces";
import { parseApiDetail } from "@/lib/api/types-helpers";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="font-sans text-sm text-fail" role="alert">
      {message}
    </p>
  );
}

export function WorksheetWizard() {
  const router = useRouter();
  const [mode, setMode] = useState<"fields" | "paste">("fields");
  const [pasteNotes, setPasteNotes] = useState("");
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [sharpening, setSharpening] = useState<WorksheetFieldName | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorksheetValues>({
    resolver: zodResolver(worksheetSchema),
    defaultValues: worksheetDefaults,
    mode: "onBlur",
  });

  const values = watch();
  const preview = composeWorksheetPreview(values);

  const saveMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: (data) => {
      toast.success("Workspace saved");
      router.push(`/workspaces/${data.workspace.id}?plan_interview=1`);
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? parseApiDetail(err.body) : "Could not save workspace";
      toast.error(msg);
    },
  });

  const draftMutation = useMutation({
    mutationFn: draftFromNotes,
    onSuccess: (data) => {
      reset(data.worksheet);
      setAiFields(new Set(data.ai_drafted_fields));
      setMode("fields");
      toast.success("AI draft applied — review and edit before saving");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? parseApiDetail(err.body) : "AI draft failed";
      toast.error(msg);
    },
  });

  async function onSharpen(fieldName: WorksheetFieldName) {
    const current = values[fieldName];
    const currentValue =
      typeof current === "string" ? current : Array.isArray(current) ? current.join(", ") : "";
    if (!currentValue.trim()) {
      toast.error("Add some text before sharpening");
      return;
    }
    setSharpening(fieldName);
    try {
      const result = await clarifyField({
        field_name: fieldName,
        current_value: currentValue,
        worksheet_context: values,
      });
      if (fieldName === "competitors") {
        setValue(
          "competitors",
          result.clarified_value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
        );
      } else {
        setValue(fieldName, result.clarified_value as never);
      }
      setAiFields((prev) => new Set(prev).add(fieldName));
      toast.success("Field sharpened");
    } catch (err) {
      const msg = err instanceof ApiError ? parseApiDetail(err.body) : "Sharpen failed";
      toast.error(msg);
    } finally {
      setSharpening(null);
    }
  }

  function onSubmit(data: WorksheetValues) {
    saveMutation.mutate({ worksheet: data });
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
          New workspace
        </p>
        <h1 className="mt-2 font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
          Idea validation worksheet
        </h1>
        <p className="mt-3 max-w-prose font-sans text-body text-ink-muted">
          Structure your idea before validation. Save a workspace first — roast the judges later.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mode === "fields" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("fields")}
        >
          Structured fields
        </Button>
        <Button
          type="button"
          variant={mode === "paste" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("paste")}
        >
          Paste notes
        </Button>
      </div>

      {mode === "paste" ? (
        <Card className="p-5">
          <Label htmlFor="paste-notes">Messy notes</Label>
          <Textarea
            id="paste-notes"
            className="mt-2 min-h-48"
            placeholder="Dump your idea, problem, audience, competitors, pricing thoughts…"
            value={pasteNotes}
            onChange={(e) => setPasteNotes(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            disabled={pasteNotes.trim().length < 20 || draftMutation.isPending}
            onClick={() => draftMutation.mutate(pasteNotes)}
          >
            {draftMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4 text-ai-processing" aria-hidden />
            )}
            Draft from notes
          </Button>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            {WORKSHEET_FIELDS.map((field) => {
              const isAi = aiFields.has(field.name);
              const error = errors[field.name]?.message as string | undefined;

              if (field.name === "competitors") {
                return (
                  <div key={field.name} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={field.name}>{field.label}</Label>
                      {isAi && <Badge variant="heat">AI draft</Badge>}
                    </div>
                    <p className="font-sans text-meta text-ink-muted">{field.prompt}</p>
                    <Textarea
                      id={field.name}
                      className="min-h-20"
                      placeholder={field.example}
                      value={values.competitors.join("\n")}
                      onChange={(e) =>
                        setValue(
                          "competitors",
                          e.target.value
                            .split(/[\n,]+/)
                            .map((s) => s.trim())
                            .filter(Boolean),
                        )
                      }
                    />
                    <FieldError message={error} />
                  </div>
                );
              }

              const InputComponent = field.multiline ? Textarea : Input;
              return (
                <div key={field.name} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={field.name}>{field.label}</Label>
                      {isAi && <Badge variant="heat">AI draft</Badge>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={sharpening === field.name}
                      onClick={() => onSharpen(field.name)}
                    >
                      {sharpening === field.name ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : (
                        <Sparkles className="size-3 text-ai-processing" aria-hidden />
                      )}
                      Sharpen
                    </Button>
                  </div>
                  <p className="font-sans text-meta text-ink-muted">{field.prompt}</p>
                  <InputComponent
                    id={field.name}
                    className={field.multiline ? "min-h-24" : undefined}
                    placeholder={field.example}
                    {...register(field.name)}
                  />
                  <FieldError message={error} />
                </div>
              );
            })}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || saveMutation.isPending}
              className="w-full sm:w-auto"
            >
              {(isSubmitting || saveMutation.isPending) && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Save workspace
            </Button>
          </div>

          <div className="lg:sticky lg:top-8 lg:self-start">
            <h2 className="font-sans text-section font-semibold text-ink">Live preview</h2>
            <pre
              className={cn(
                "mt-3 max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-ui",
                "border border-rule-soft bg-paper-2 p-4 font-mono text-sm leading-relaxed text-ink",
              )}
            >
              {preview}
            </pre>
          </div>
        </form>
      )}
    </div>
  );
}
