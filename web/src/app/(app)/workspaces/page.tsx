import { EditorialContainer } from "@/components/app-shell";
import { WorkspaceList } from "@/features/workspace/workspace-list";

export default function WorkspacesPage() {
  return (
    <EditorialContainer className="py-8 md:py-12">
      <WorkspaceList />
    </EditorialContainer>
  );
}
