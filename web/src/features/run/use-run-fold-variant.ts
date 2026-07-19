"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import {
  resolveRunFoldVariant,
  type RunFoldVariant,
} from "./run-fold-layout";

/** Workflow-first by default; `?fold=a|b` overrides for maintainer A/B checks. */
export function useRunFoldVariant(initialQueryFold?: string | null): {
  variant: RunFoldVariant;
} {
  const searchParams = useSearchParams();
  const queryFold = searchParams.get("fold") ?? initialQueryFold ?? null;

  const variant = useMemo(
    () => resolveRunFoldVariant(queryFold, null),
    [queryFold],
  );

  return { variant };
}
