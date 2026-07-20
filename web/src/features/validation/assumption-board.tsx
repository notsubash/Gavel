"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  ASSUMPTION_COLUMNS,
  type Assumption,
  type AssumptionStatus,
} from "@/lib/api/workspaces";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { Label } from "@/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";

import {
  ASSUMPTION_STATUS_LABEL,
  ASSUMPTION_STATUS_STYLE,
  humanizeEnum,
} from "./validation-labels";
import { cn } from "@/lib/utils";
import type { ValidationMutations } from "./use-validation-mutations";

/** ponytail: list until this many assumptions; board after that. */
export const ASSUMPTION_BOARD_THRESHOLD = 5;

const LIST_PRIORITY: AssumptionStatus[] = [
  "untested",
  "testing",
  "contradicted",
  "supported",
  "retired",
];

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

function AssumptionCard({
  assumption,
  pendingId,
  announcement,
  onStatusChange,
  showStatusBadge,
}: {
  assumption: Assumption;
  pendingId: string | null;
  announcement: string | null;
  onStatusChange: (id: string, status: AssumptionStatus) => void;
  showStatusBadge?: boolean;
}) {
  const style = ASSUMPTION_STATUS_STYLE[assumption.status];
  return (
    <Card className={cn("border-l-4 p-3", style.accent, style.tint)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-sans text-sm text-ink">{assumption.statement}</p>
        {showStatusBadge ? (
          <Badge variant="default" className={cn("shrink-0", style.text)}>
            {ASSUMPTION_STATUS_LABEL[assumption.status]}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 font-sans text-xs text-ink-muted">
        Type: {humanizeEnum(assumption.type)}
      </p>
      <AssumptionStatusControl
        assumption={assumption}
        pendingId={pendingId}
        announcement={announcement}
        onStatusChange={onStatusChange}
      />
    </Card>
  );
}

export function shouldUseAssumptionBoard(assumptionCount: number): boolean {
  return assumptionCount > ASSUMPTION_BOARD_THRESHOLD;
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

  const rankedList = useMemo(() => {
    const rank = new Map(LIST_PRIORITY.map((status, index) => [status, index]));
    return [...assumptions].sort(
      (a, b) => (rank.get(a.status) ?? 99) - (rank.get(b.status) ?? 99),
    );
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

  const useBoard = shouldUseAssumptionBoard(assumptions.length);

  if (!useBoard) {
    return (
      <section aria-labelledby="assumption-board-heading">
        <h2
          id="assumption-board-heading"
          className="font-sans text-section font-semibold text-ink"
        >
          Top risks
        </h2>
        <p className="mt-1 font-sans text-sm text-ink-muted">
          Focus on the riskiest assumptions first. A board appears after{" "}
          {ASSUMPTION_BOARD_THRESHOLD} assumptions.
        </p>
        <ul className="mt-4 space-y-2" aria-label="Top risk assumptions">
          {rankedList.map((assumption) => (
            <li key={assumption.id}>
              <AssumptionCard
                assumption={assumption}
                pendingId={pendingId}
                announcement={
                  announcement?.id === assumption.id ? announcement.message : null
                }
                onStatusChange={handleStatusChange}
                showStatusBadge
              />
            </li>
          ))}
        </ul>
        {assumptions.length === 0 ? (
          <p className="mt-4 font-sans text-sm text-ink-muted">No assumptions yet.</p>
        ) : null}
      </section>
    );
  }

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
        {ASSUMPTION_COLUMNS.map((col) => {
          const style = ASSUMPTION_STATUS_STYLE[col];
          const count = byColumn[col].length;
          return (
            <div key={col} role="listitem" className="min-w-0 space-y-2">
              <h3 className="flex items-center gap-2 font-sans text-meta font-semibold uppercase tracking-wide">
                <span className={cn("size-2 shrink-0 rounded-full", style.dot)} aria-hidden />
                <span className={style.text}>{ASSUMPTION_STATUS_LABEL[col]}</span>
                <span className="ml-auto font-mono text-xs tabular-nums text-ink-subtle">
                  {count}
                </span>
              </h3>
              <ul className="space-y-2">
                {byColumn[col].map((assumption) => (
                  <li key={assumption.id}>
                    <AssumptionCard
                      assumption={assumption}
                      pendingId={pendingId}
                      announcement={
                        announcement?.id === assumption.id ? announcement.message : null
                      }
                      onStatusChange={handleStatusChange}
                    />
                  </li>
                ))}
                {byColumn[col].length === 0 && (
                  <p className="font-sans text-xs text-ink-muted">Empty</p>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
