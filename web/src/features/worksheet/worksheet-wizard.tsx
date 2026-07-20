"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { WorksheetFieldRenderer } from "@/features/worksheet/worksheet-field-renderer";
import { composeWorksheetPreview } from "@/features/worksheet/worksheet-preview";
import {
  CREATE_CORE_FIELDS,
  DETAIL_FIELDS,
  countFilledWorksheetFields,
  createWorksheetSchema,
  fillDeferredPlaceholders,
  isWeakFieldValue,
  worksheetDefaults,
  normalizeWorksheetValues,
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
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";

const PASTE_MIN_LENGTH = 20;
/** Phase 3: hide Sharpen until the founder has engaged enough fields. */
const SHARPEN_MIN_FILLED = 3;

export function WorksheetWizard() {
  const router = useRouter();
  const pasteHintId = useId();
  const [mode, setMode] = useState<"fields" | "paste">("fields");
  const [fieldStep, setFieldStep] = useState(0);
  const [mobileWizard, setMobileWizard] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const mobileFieldRef = useRef<HTMLDivElement>(null);
  const [pasteNotes, setPasteNotes] = useState("");
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [engagedFields, setEngagedFields] = useState<Set<string>>(new Set());
  const [sharpening, setSharpening] = useState<WorksheetFieldName | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<WorksheetValues>({
    resolver: zodResolver(createWorksheetSchema),
    defaultValues: worksheetDefaults,
    mode: "onBlur",
  });

  const values = watch();
  const preview = composeWorksheetPreview(values);
  const filledCount = countFilledWorksheetFields(values);
  const sharpenUnlocked = filledCount >= SHARPEN_MIN_FILLED;

  const visibleFields = useMemo(
    () => (showDetail ? [...CREATE_CORE_FIELDS, ...DETAIL_FIELDS] : CREATE_CORE_FIELDS),
    [showDetail],
  );

  const saveMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: (data) => {
      toast.success("Workspace saved");
      router.push(`/workspaces/${data.workspace.id}/validation?log_interview=1`);
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
      reset(normalizeWorksheetValues(data.worksheet));
      setAiFields(new Set(data.ai_drafted_fields));
      setShowDetail(true);
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
    saveMutation.mutate({ worksheet: fillDeferredPlaceholders(data) });
  }

  function markEngaged(name: WorksheetFieldName) {
    setEngagedFields((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }

  function fieldValueText(name: WorksheetFieldName): string {
    const current = values[name];
    if (typeof current === "string") return current;
    if (Array.isArray(current)) return current.join(", ");
    return "";
  }

  function showSharpenFor(name: WorksheetFieldName): boolean {
    if (!sharpenUnlocked || !engagedFields.has(name)) return false;
    return isWeakFieldValue(fieldValueText(name));
  }

  function renderField(field: (typeof CREATE_CORE_FIELDS)[number]) {
    const error = errors[field.name]?.message as string | undefined;
    const errorId = `${field.name}-error`;

    return (
      <WorksheetFieldRenderer
        key={field.name}
        field={field}
        values={values}
        error={error}
        errorId={errorId}
        register={register}
        setValue={setValue}
        onSharpen={onSharpen}
        sharpening={sharpening}
        showSharpen={showSharpenFor(field.name)}
        onFieldBlur={markEngaged}
        isAiDraft={aiFields.has(field.name)}
        showOptionalBadge
      />
    );
  }

  const mobileField = visibleFields[fieldStep] ?? visibleFields[0];

  async function onMobileNext() {
    const valid = await trigger(mobileField.name);
    if (valid) {
      setFieldStep((s) => s + 1);
    }
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobileWizard(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobileWizard) return;
    mobileFieldRef.current?.querySelector<HTMLElement>("input,textarea")?.focus();
  }, [fieldStep, mobileWizard]);

  useEffect(() => {
    if (fieldStep >= visibleFields.length) {
      setFieldStep(Math.max(0, visibleFields.length - 1));
    }
  }, [fieldStep, visibleFields.length]);

  return (
    <div className="space-y-8">
      <header>
        <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
          New idea
        </p>
        <h1 className="mt-2 font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
          Draft your case for Gavel
        </h1>
        <p className="mt-3 max-w-prose font-sans text-body text-ink-muted">
          Capture the core pitch in five fields. Add detail later on Pitch, or paste messy notes
          to draft everything at once.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Input mode">
        <Button
          type="button"
          variant={mode === "fields" ? "default" : "outline"}
          size="sm"
          aria-pressed={mode === "fields"}
          onClick={() => setMode("fields")}
        >
          Structured fields
        </Button>
        <Button
          type="button"
          variant={mode === "paste" ? "default" : "outline"}
          size="sm"
          aria-pressed={mode === "paste"}
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
            aria-describedby={pasteHintId}
            aria-invalid={
              pasteNotes.trim().length > 0 && pasteNotes.trim().length < PASTE_MIN_LENGTH
                ? true
                : undefined
            }
          />
          <p id={pasteHintId} className="mt-2 font-sans text-meta text-ink-muted">
            At least {PASTE_MIN_LENGTH} characters so the AI draft has enough context.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            disabled={pasteNotes.trim().length < PASTE_MIN_LENGTH || draftMutation.isPending}
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
            {mobileWizard ? (
              <div
                role="group"
                aria-label={`Worksheet field ${fieldStep + 1} of ${visibleFields.length}`}
                ref={mobileFieldRef}
              >
                <p className="font-sans text-meta text-ink-muted" aria-current="step">
                  Field {fieldStep + 1} of {visibleFields.length}: {mobileField.label}
                </p>
                {renderField(mobileField)}
                {!showDetail && fieldStep === CREATE_CORE_FIELDS.length - 1 ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex min-h-11 items-center gap-1 font-sans text-sm font-semibold text-cta hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
                    onClick={() => {
                      setShowDetail(true);
                      setFieldStep(CREATE_CORE_FIELDS.length);
                    }}
                  >
                    Add more detail
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                ) : null}
                <div className="mt-4 flex justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={fieldStep === 0}
                    onClick={() => setFieldStep((s) => Math.max(0, s - 1))}
                  >
                    Back
                  </Button>
                  {fieldStep < visibleFields.length - 1 ? (
                    <Button type="button" onClick={() => void onMobileNext()}>
                      Next
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
                      Save workspace
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {CREATE_CORE_FIELDS.map((field) => renderField(field))}

                <details
                  className="rounded-ui border border-rule-soft bg-card"
                  open={showDetail}
                  onToggle={(e) => setShowDetail((e.target as HTMLDetailsElement).open)}
                >
                  <summary
                    className={cn(
                      "flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3",
                      "font-sans text-sm font-semibold text-ink",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta",
                      "[&::-webkit-details-marker]:hidden",
                    )}
                  >
                    Add more detail
                    <ChevronDown className="size-4 text-ink-muted" aria-hidden />
                    <span className="ml-auto font-sans text-xs font-normal text-ink-muted">
                      Optional — can finish on Pitch
                    </span>
                  </summary>
                  <div className="space-y-6 border-t border-rule-soft px-4 py-4">
                    {DETAIL_FIELDS.map((field) => renderField(field))}
                  </div>
                </details>

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
              </>
            )}
          </div>

          <div className="lg:sticky lg:top-8 lg:self-start">
            <h2 className="font-sans text-section font-semibold text-ink">Live preview</h2>
            <pre
              className={cn(
                "mt-3 max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-ui md:max-h-[70vh]",
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
