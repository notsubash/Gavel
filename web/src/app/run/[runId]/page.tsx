import { Suspense } from "react";

import { RunSheet } from "@/features/run/run-sheet";
import { EditorialContainer } from "@/components/app-shell";
import { Skeleton } from "@/ui/skeleton";

type RunPageProps = {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ fold?: string }>;
};

function RunSheetFallback() {
  return (
    <EditorialContainer className="py-12 md:py-16 lg:py-24">
      <div className="col-span-12 space-y-4 lg:col-span-10 lg:col-start-2">
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
