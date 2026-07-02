import { Suspense } from "react";

import { RunSheet } from "@/features/run/run-sheet";
import { EditorialContainer } from "@/components/app-shell";
import { isUiShellV2Enabled } from "@/lib/feature-flags";
import { Skeleton } from "@/ui/skeleton";

type RunPageProps = {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ fold?: string }>;
};

function RunSheetFallback() {
  return (
    <EditorialContainer className={isUiShellV2Enabled() ? "py-6 md:py-8" : "py-12 md:py-16 lg:py-24"}>
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-24 w-full" />
      </div>
    </EditorialContainer>
  );
}

export default async function RunPage({ params, searchParams }: RunPageProps) {
  const { runId } = await params;
  const { fold } = await searchParams;

  return (
    <Suspense fallback={<RunSheetFallback />}>
      <RunSheet runId={runId} initialFold={fold} />
    </Suspense>
  );
}
