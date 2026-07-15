import { EditorialContainer } from "@/components/app-shell";
import { WorksheetWizard } from "@/features/worksheet/worksheet-wizard";

export default function NewWorkspacePage() {
  return (
    <EditorialContainer className="py-8 md:py-12">
      <WorksheetWizard />
    </EditorialContainer>
  );
}
