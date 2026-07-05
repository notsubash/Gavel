"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  ASSUMPTION_COLUMNS,
  type Assumption,
  type AssumptionStatus,
} from "@/lib/api/workspaces";
import { Card } from "@/ui/card";
import { Label } from "@/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";

import { ASSUMPTION_STATUS_LABEL, humanizeEnum } from "./validation-labels";
import type { ValidationMutations } from "./use-validation-mutations";

function AssumptionStatusControl({
  assumption,
  pendingId,
  announcement,
  onStatusChange,
}: {
  assumption: Assumption;
  pendingId: string | null;
  announcement: string | null;
  onStatusChange: (id: string, status: AssumptionStatus) => void;
}) {
  const pending = pendingId === assumption.id;
  const options = ASSUMPTION_COLUMNS.filter((status) => status !== assumption.status);

  if (assumption.status === "retired" || options.length === 0) return null;

  return (
    <div className="mt-3">
      <Label htmlFor={`assumption-status-${assumption.id}`} className="font-sans text-xs text-ink-muted">
        Move to
      </Label>
      <Select
        disabled={pending}
        onValueChange={(next) => onStatusChange(assumption.id, next as AssumptionStatus)}
      >
        <SelectTrigger
          id={`assumption-status-${assumption.id}`}
          className="mt-1 min-h-11"
          aria-busy={pending}
          aria-label={`Move assumption to another status`}
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Updating…
            </span>
          ) : (
            <SelectValue placeholder="Move to…" />
          )}
        </SelectTrigger>
        <SelectContent>
          {options.map((status) => (
            <SelectItem key={status} value={status}>
              {ASSUMPTION_STATUS_LABEL[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {announcement ? (
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      ) : null}
    </div>
  );
}

export function AssumptionBoard({
  assumptions,
  mutations,
}: {
  assumptions: Assumption[];
  mutations: ValidationMutations;
}) {
  const { statusMutation } = mutations;
  const [announcement, setAnnouncement] = useState<{ id: string; message: string } | null>(
    null,
  );
  const pendingId = statusMutation.isPending
    ? (statusMutation.variables?.id ?? null)
    : null;

  const byColumn = useMemo(() => {
    const map: Record<AssumptionStatus, Assumption[]> = {
      untested: [],
      testing: [],
      supported: [],
      contradicted: [],
      retired: [],
    };
    for (const assumption of assumptions) {
      map[assumption.status]?.push(assumption);
    }
    return map;
  }, [assumptions]);

  const handleStatusChange = (id: string, status: AssumptionStatus) => {
    statusMutation.mutate(
      { id, status },
      {
        onSuccess: () =>
          setAnnouncement({
            id,
            message: `Moved to ${ASSUMPTION_STATUS_LABEL[status]}`,
          }),
      },
    );
  };

  return (
    <section aria-labelledby="assumption-board-heading">
      <h2
        id="assumption-board-heading"
        className="font-sans text-section font-semibold text-ink"
      >
        Assumption board
      </h2>
      <div
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        role="list"
        aria-label="Assumption kanban columns"
      >
        {ASSUMPTION_COLUMNS.map((col) => (
          <div key={col} role="listitem" className="min-w-0 space-y-2">
            <h3 className="font-sans text-meta font-semibold uppercase tracking-wide text-ink-subtle">
              {ASSUMPTION_STATUS_LABEL[col]}
            </h3>
            <ul className="space-y-2">
              {byColumn[col].map((assumption) => (
                <li key={assumption.id}>
                  <Card className="p-3">
                    <p className="font-sans text-sm text-ink">{assumption.statement}</p>
                    <p className="mt-1 font-sans text-xs text-ink-muted">
                      Type: {humanizeEnum(assumption.type)}
                    </p>
                    <AssumptionStatusControl
                      assumption={assumption}
                      pendingId={pendingId}
                      announcement={
                        announcement?.id === assumption.id ? announcement.message : null
                      }
                      onStatusChange={handleStatusChange}
                    />
                  </Card>
                </li>
              ))}
              {byColumn[col].length === 0 && (
                <p className="font-sans text-xs text-ink-muted">Empty</p>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
