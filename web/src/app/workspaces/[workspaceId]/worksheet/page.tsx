import { Suspense } from "react";

import { WorksheetEditor } from "@/features/worksheet/worksheet-editor";
import { Skeleton } from "@/ui/skeleton";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

function EditorFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default async function WorksheetPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <Suspense fallback={<EditorFallback />}>
      <WorksheetEditor workspaceId={workspaceId} />
    </Suspense>
  );
}
