import { EditorialContainer } from "@/components/app-shell";
import { WorkspaceNav } from "@/features/workspace/workspace-nav";

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceDetailLayout({ children, params }: Props) {
  const { workspaceId } = await params;
  return (
    <EditorialContainer className="py-8 md:py-12">
      <WorkspaceNav workspaceId={workspaceId} />
      {children}
    </EditorialContainer>
  );
}
