import { Suspense } from "react";

import { EditorialContainer } from "@/components/app-shell";
import { JudgesView } from "@/features/judges/judges-view";
import { Skeleton } from "@/ui/skeleton";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function JudgesPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <EditorialContainer className="py-8 md:py-12">
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <JudgesView workspaceId={workspaceId} />
      </Suspense>
    </EditorialContainer>
  );
}
