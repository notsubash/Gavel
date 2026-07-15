import { Suspense } from "react";

import { WorkspaceOverview } from "@/features/workspace/workspace-overview";
import { Skeleton } from "@/ui/skeleton";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

function OverviewFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default async function WorkspaceDetailPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <Suspense fallback={<OverviewFallback />}>
      <WorkspaceOverview workspaceId={workspaceId} />
    </Suspense>
  );
}
