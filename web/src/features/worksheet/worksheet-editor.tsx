"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { composeWorksheetPreview } from "@/features/worksheet/worksheet-preview";
import {
  WORKSHEET_FIELDS,
  worksheetSchema,
  type WorksheetFieldName,
  type WorksheetValues,
} from "@/features/worksheet/worksheet-schema";
import {
  coreFieldsChanged,
  localWorksheetDiff,
  WorksheetVersionDiff,
} from "@/features/worksheet/worksheet-version-diff";
import { CORE_WORKSHEET_FIELDS } from "@/features/worksheet/worksheet-core-fields";
import { ApiError } from "@/lib/api/client";
import { parseApiDetail } from "@/lib/api/types-helpers";
import {
  clarifyField,
  getWorksheetVersionDiff,
  getWorkspace,
  listWorksheetVersions,
  reviseFromEvidence,
  saveWorksheetVersion,
  type WorksheetFieldPatch,
  type WorksheetVersion,
  worksheetVersionsQueryKey,
  workspaceQueryKey,
} from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Skeleton } from "@/ui/skeleton";
import { Textarea } from "@/ui/textarea";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="font-sans text-sm text-fail" role="alert">
      {message}
    </p>
  );
}

export function WorksheetEditor({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const reviseExperimentId = searchParams.get("revise_experiment");

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [minorEdit, setMinorEdit] = useState(false);
  const [sharpening, setSharpening] = useState<WorksheetFieldName | null>(null);
  const [revisePatches, setRevisePatches] = useState<WorksheetFieldPatch[]>([]);
  const [acceptedPatches, setAcceptedPatches] = useState<Set<string>>(new Set());
  const [reviseSummary, setReviseSummary] = useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: workspaceQueryKey(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
  });

  const versionsQuery = useQuery({
    queryKey: worksheetVersionsQueryKey(workspaceId),
    queryFn: () => listWorksheetVersions(workspaceId),
  });

  const currentVersion = workspaceQuery.data?.current_version;
  const versions = versionsQuery.data ?? [];
  const compareVersionId = selectedVersionId ?? currentVersion?.id ?? null;

  const diffQuery = useQuery({
    queryKey: ["worksheet-version-diff", workspaceId, compareVersionId],
    queryFn: () => getWorksheetVersionDiff(workspaceId, compareVersionId!),
    enabled: Boolean(compareVersionId) && compareVersionId !== currentVersion?.id,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorksheetValues>({
    resolver: zodResolver(worksheetSchema),
    defaultValues: workspaceQuery.data?.current_version.worksheet,
    mode: "onBlur",
  });

  useEffect(() => {
    if (currentVersion) {
      reset(currentVersion.worksheet);
      setSelectedVersionId(null);
    }
  }, [currentVersion, reset]);

  const values = watch();
  const preview = composeWorksheetPreview(values);

  const pendingDiff = useMemo(() => {
    if (!currentVersion) return [];
    return localWorksheetDiff(
      currentVersion.worksheet as Record<string, unknown>,
      values as Record<string, unknown>,
    );
  }, [currentVersion, values]);

  const willBumpVersion =
    pendingDiff.length > 0 &&
    coreFieldsChanged(
      currentVersion?.worksheet as Record<string, unknown>,
      values as Record<string, unknown>,
    ) &&
    !minorEdit;

  const suppressingVersionBump =
    pendingDiff.length > 0 &&
    coreFieldsChanged(
      currentVersion?.worksheet as Record<string, unknown>,
      values as Record<string, unknown>,
    ) &&
    minorEdit;

  const saveMutation = useMutation({
    mutationFn: (data: WorksheetValues) =>
      saveWorksheetVersion(workspaceId, {
        worksheet: data,
        minor_edit: minorEdit,
        base_version_id: currentVersion?.id,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: worksheetVersionsQueryKey(workspaceId) });
      if (res.created) {
        toast.success(`Saved as version ${res.version.version}`);
      } else {
        toast.success("Worksheet updated in place");
      }
      setMinorEdit(false);
      setRevisePatches([]);
      setAcceptedPatches(new Set());
      setReviseSummary(null);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Worksheet changed elsewhere — refreshing");
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
        return;
      }
      const msg =
        err instanceof ApiError ? parseApiDetail(err.body) : "Could not save worksheet";
      toast.error(msg);
    },
  });

  const reviseMutation = useMutation({
    mutationFn: () => reviseFromEvidence(workspaceId, reviseExperimentId ?? undefined),
    onSuccess: (res) => {
      setRevisePatches(res.patches);
      setReviseSummary(res.summary);
      setAcceptedPatches(new Set(res.patches.map((p) => p.field_name)));
      toast.success("Evidence-based suggestions ready");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Revise assist failed");
    },
  });

  const showRevisePanel =
    searchParams.get("revise") === "1" || Boolean(reviseExperimentId);

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
      toast.success("Field sharpened");
    } catch (err) {
      const msg = err instanceof ApiError ? parseApiDetail(err.body) : "Sharpen failed";
      toast.error(msg);
    } finally {
      setSharpening(null);
    }
  }

  function applyAcceptedPatches() {
    const nextValues = { ...values };
    let invalidField: string | null = null;

    for (const patch of revisePatches) {
      if (!acceptedPatches.has(patch.field_name)) continue;
      const name = patch.field_name as WorksheetFieldName;
      if (name === "competitors") {
        nextValues.competitors = patch.suggested_value
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        (nextValues as Record<string, unknown>)[name] = patch.suggested_value;
      }
    }

    const parsed = worksheetSchema.safeParse(nextValues);
    if (!parsed.success) {
      invalidField = parsed.error.issues[0]?.path[0]?.toString() ?? "worksheet";
      toast.error(`Patch failed validation on ${invalidField.replace(/_/g, " ")}`);
      return;
    }

    for (const patch of revisePatches) {
      if (!acceptedPatches.has(patch.field_name)) continue;
      const name = patch.field_name as WorksheetFieldName;
      if (name === "competitors") {
        setValue("competitors", parsed.data.competitors);
      } else {
        setValue(name, parsed.data[name] as never);
      }
    }
    toast.message("Patches applied to form — review and save to create a new version");
  }

  function onSubmit(data: WorksheetValues) {
    saveMutation.mutate(data);
  }

  if (workspaceQuery.isLoading || versionsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (workspaceQuery.isError || !currentVersion) {
    return (
      <p className="font-sans text-body text-fail" role="alert">
        Worksheet unavailable.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
          Worksheet
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
            {values.working_name || "Untitled"}
          </h1>
          <Badge variant="default">v{currentVersion.version}</Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/workspaces/${workspaceId}`}>Overview</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/workspaces/${workspaceId}/validation`}>Validation</Link>
          </Button>
        </div>
      </header>

      <section aria-labelledby="version-timeline-heading">
        <h2 id="version-timeline-heading" className="font-sans text-section font-semibold text-ink">
          Version history
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {versions.map((v: WorksheetVersion) => (
            <li key={v.id}>
              <Button
                type="button"
                size="sm"
                variant={
                  selectedVersionId === v.id || (!selectedVersionId && v.id === currentVersion.id)
                    ? "default"
                    : "outline"
                }
                onClick={() => setSelectedVersionId(v.id === currentVersion.id ? null : v.id)}
              >
                v{v.version}
                {v.id === currentVersion.id ? " (current)" : ""}
              </Button>
            </li>
          ))}
        </ul>
        {selectedVersionId && selectedVersionId !== currentVersion.id && (
          <Card className="mt-4 p-5">
            <h3 className="font-sans text-body font-semibold text-ink">Changes in this version</h3>
            {diffQuery.isLoading && <Skeleton className="mt-3 h-24 w-full" />}
            {diffQuery.data && (
              <WorksheetVersionDiff
                className="mt-3"
                changes={diffQuery.data.changes}
                changeSummary={diffQuery.data.change_summary}
              />
            )}
          </Card>
        )}
      </section>

      {(showRevisePanel) && (
        <Card className="space-y-4 border-cta/30 p-5">
          <h2 className="font-sans text-section font-semibold text-ink">Revise from evidence</h2>
          {reviseSummary && (
            <p className="font-sans text-sm text-ink-muted">
              <Badge variant="heat" className="mb-2">
                AI summary
              </Badge>
              <span className="block">{reviseSummary}</span>
            </p>
          )}
          {revisePatches.length === 0 ? (
            <Button
              type="button"
              onClick={() => reviseMutation.mutate()}
              disabled={reviseMutation.isPending}
            >
              {reviseMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="mr-2 size-4" aria-hidden />
              )}
              Suggest field updates
            </Button>
          ) : (
            <div className="space-y-3">
              {revisePatches.map((patch) => (
                <div key={patch.field_name} className="rounded-ui border border-rule-soft p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={acceptedPatches.has(patch.field_name)}
                      onChange={(e) => {
                        setAcceptedPatches((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(patch.field_name);
                          else next.delete(patch.field_name);
                          return next;
                        });
                      }}
                    />
                    <span>
                      <span className="font-sans text-sm font-semibold text-ink">
                        {patch.field_name.replace(/_/g, " ")}
                      </span>
                      <span className="mt-1 block font-sans text-sm text-ink-muted">
                        {patch.rationale}
                      </span>
                      <span className="mt-2 block font-sans text-sm text-ink">
                        {patch.suggested_value}
                      </span>
                    </span>
                  </label>
                </div>
              ))}
              <Button type="button" onClick={applyAcceptedPatches}>
                Apply selected to form
              </Button>
            </div>
          )}
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          {willBumpVersion && (
            <Card className="border-cta/40 bg-paper-2 p-4" role="status">
              <p className="font-sans text-sm font-medium text-ink">
                This creates version {currentVersion.version + 1}
              </p>
              <p className="mt-1 font-sans text-sm text-ink-muted">
                Core fields changed. Saving records a new version linked to your evidence timeline.
              </p>
            </Card>
          )}

          {suppressingVersionBump && (
            <Card className="border-conditional/40 bg-paper-2 p-4" role="status">
              <p className="font-sans text-sm font-medium text-ink">
                Saving without creating a new version
              </p>
              <p className="mt-1 font-sans text-sm text-ink-muted">
                Minor edit is checked. Core field changes will patch the current version in place.
              </p>
            </Card>
          )}

          {pendingDiff.length > 0 &&
            coreFieldsChanged(
              currentVersion.worksheet as Record<string, unknown>,
              values as Record<string, unknown>,
            ) && (
              <div className="flex items-center gap-2 rounded-ui border border-rule-soft p-3">
                <input
                  id="minor-edit"
                  type="checkbox"
                  checked={minorEdit}
                  onChange={(e) => setMinorEdit(e.target.checked)}
                />
                <Label htmlFor="minor-edit" className="font-sans text-sm text-ink-muted">
                  Minor edit only (typo fix, no new version)
                </Label>
              </div>
            )}

          {WORKSHEET_FIELDS.map((field) => {
            const error = errors[field.name]?.message as string | undefined;
            const isCore = CORE_WORKSHEET_FIELDS.has(field.name);

            if (field.name === "competitors") {
              return (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {isCore && (
                      <span className="ml-2 font-sans text-xs text-cta">versioned</span>
                    )}
                  </Label>
                  <Textarea
                    id={field.name}
                    className="min-h-20"
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
                  <Label htmlFor={field.name}>
                    {field.label}
                    {isCore && (
                      <span className="ml-2 font-sans text-xs text-cta">versioned</span>
                    )}
                  </Label>
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
                <InputComponent
                  id={field.name}
                  className={field.multiline ? "min-h-24" : undefined}
                  {...register(field.name)}
                />
                <FieldError message={error} />
              </div>
            );
          })}

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || saveMutation.isPending || pendingDiff.length === 0}
            className="w-full sm:w-auto"
          >
            {(isSubmitting || saveMutation.isPending) && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {willBumpVersion
              ? `Save as version ${currentVersion.version + 1}`
              : "Save worksheet"}
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
          {pendingDiff.length > 0 && (
            <div className="mt-6">
              <h3 className="font-sans text-body font-semibold text-ink">Pending changes</h3>
              <WorksheetVersionDiff className="mt-3" changes={pendingDiff} />
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
