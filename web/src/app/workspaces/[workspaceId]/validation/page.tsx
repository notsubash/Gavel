import { Suspense } from "react";

import { EditorialContainer } from "@/components/app-shell";
import { ValidationView } from "@/features/validation/validation-view";
import { Skeleton } from "@/ui/skeleton";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

function ValidationFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default async function ValidationPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <EditorialContainer className="py-8 md:py-12">
      <Suspense fallback={<ValidationFallback />}>
        <ValidationView workspaceId={workspaceId} />
      </Suspense>
    </EditorialContainer>
  );
}
