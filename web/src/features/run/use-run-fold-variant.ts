"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  foldVariantToQueryFlag,
  resolveRunFoldVariant,
  type RunFoldVariant,
} from "./run-fold-layout";
import {
  readStoredFoldVariant,
  saveAdvancedSettings,
} from "@/lib/settings/advanced-settings";

export function useRunFoldVariant(initialQueryFold?: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryFold = searchParams.get("fold") ?? initialQueryFold ?? null;

  const [variant, setVariantState] = useState<RunFoldVariant>(() =>
    resolveRunFoldVariant(initialQueryFold ?? null, readStoredFoldVariant()),
  );

  // ponytail: re-sync when ?fold= changes via browser navigation
  useEffect(() => {
    const next = resolveRunFoldVariant(queryFold, readStoredFoldVariant());
    queueMicrotask(() => setVariantState(next));
  }, [queryFold]);

  const setVariant = useCallback(
    (next: RunFoldVariant) => {
      setVariantState(next);
      saveAdvancedSettings({ run_fold_variant: next });
      const params = new URLSearchParams(searchParams.toString());
      params.set("fold", foldVariantToQueryFlag(next));
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { variant, setVariant };
}
