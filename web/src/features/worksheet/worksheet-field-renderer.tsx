"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { UseFormRegister, UseFormSetValue } from "react-hook-form";

import { CORE_WORKSHEET_FIELDS } from "@/features/worksheet/worksheet-core-fields";
import {
  WORKSHEET_FIELDS,
  type WorksheetFieldName,
  type WorksheetValues,
} from "@/features/worksheet/worksheet-schema";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="font-sans text-sm text-fail" role="alert">
      {message}
    </p>
  );
}

export type WorksheetFieldRendererProps = {
  field: (typeof WORKSHEET_FIELDS)[number];
  values: WorksheetValues;
  error?: string;
  register: UseFormRegister<WorksheetValues>;
  setValue: UseFormSetValue<WorksheetValues>;
  onSharpen?: (name: WorksheetFieldName) => void;
  sharpening?: WorksheetFieldName | null;
  isAiDraft?: boolean;
  showVersioned?: boolean;
  errorId?: string;
};

export function WorksheetFieldRenderer({
  field,
  values,
  error,
  register,
  setValue,
  onSharpen,
  sharpening,
  isAiDraft,
  showVersioned,
  errorId,
}: WorksheetFieldRendererProps) {
  const isCore = showVersioned && CORE_WORKSHEET_FIELDS.has(field.name);
  const canSharpen = Boolean(onSharpen);

  if (field.name === "competitors") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={field.name}>
              {field.label}
              {isCore && (
                <span className="ml-2 font-sans text-xs text-cta">versioned</span>
              )}
            </Label>
            {isAiDraft && <Badge variant="heat">AI draft</Badge>}
          </div>
          {canSharpen && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={sharpening === field.name}
              onClick={() => onSharpen!(field.name)}
            >
              {sharpening === field.name ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-3 text-ai-processing" aria-hidden />
              )}
              Sharpen
            </Button>
          )}
        </div>
        <p className="font-sans text-meta text-ink-muted">{field.prompt}</p>
        <Textarea
          id={field.name}
          className="min-h-20"
          placeholder={field.example}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
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
        <FieldError message={error} id={errorId} />
      </div>
    );
  }

  const InputComponent = field.multiline ? Textarea : Input;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={field.name}>
            {field.label}
            {isCore && (
              <span className="ml-2 font-sans text-xs text-cta">versioned</span>
            )}
          </Label>
          {isAiDraft && <Badge variant="heat">AI draft</Badge>}
        </div>
        {canSharpen && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={sharpening === field.name}
            onClick={() => onSharpen!(field.name)}
          >
            {sharpening === field.name ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3 text-ai-processing" aria-hidden />
            )}
            Sharpen
          </Button>
        )}
      </div>
      <p className="font-sans text-meta text-ink-muted">{field.prompt}</p>
      <InputComponent
        id={field.name}
        className={field.multiline ? "min-h-24" : undefined}
        placeholder={field.example}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...register(field.name)}
      />
      <FieldError message={error} id={errorId} />
    </div>
  );
}
