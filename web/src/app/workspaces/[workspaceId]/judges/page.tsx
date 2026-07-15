import { Suspense } from "react";

import { JudgesView } from "@/features/judges/judges-view";
import { Skeleton } from "@/ui/skeleton";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function JudgesPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <JudgesView workspaceId={workspaceId} />
    </Suspense>
  );
}
