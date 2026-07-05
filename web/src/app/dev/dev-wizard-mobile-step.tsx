"use client";

import { useForm } from "react-hook-form";

import { WorksheetFieldRenderer } from "@/features/worksheet/worksheet-field-renderer";
import {
  WORKSHEET_FIELDS,
  worksheetDefaults,
  type WorksheetValues,
} from "@/features/worksheet/worksheet-schema";
import { Button } from "@/ui/button";

/** Mobile wizard step chrome (one field + step indicator) for /dev. */
export function WorksheetWizardMobileStepDemo() {
  const field = WORKSHEET_FIELDS[2];
  const { register, setValue, watch } = useForm<WorksheetValues>({
    defaultValues: {
      ...worksheetDefaults,
      problem_statement: "Manual scheduling creates audit gaps.",
    },
  });

  return (
    <div
      className="w-full max-w-md rounded-ui border border-rule-soft bg-card p-5"
      role="group"
      aria-label={`Worksheet field 3 of ${WORKSHEET_FIELDS.length}`}
    >
      <p className="font-sans text-meta text-ink-muted" aria-current="step">
        Field 3 of {WORKSHEET_FIELDS.length}: {field.label}
      </p>
      <div className="mt-4">
        <WorksheetFieldRenderer
          field={field}
          values={watch()}
          register={register}
          setValue={setValue}
        />
      </div>
      <div className="mt-4 flex justify-between gap-3">
        <Button type="button" variant="outline">
          Back
        </Button>
        <Button type="button">Next</Button>
      </div>
    </div>
  );
}
