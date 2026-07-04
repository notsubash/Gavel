import { EditorialContainer } from "@/components/app-shell";
import { WorkspaceOverview } from "@/features/workspace/workspace-overview";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceDetailPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <EditorialContainer className="py-8 md:py-12">
      <WorkspaceOverview workspaceId={workspaceId} />
    </EditorialContainer>
  );
}
