import { ValidationView } from "@/features/validation/validation-view";
import { EditorialContainer } from "@/components/app-shell";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function ValidationPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <EditorialContainer className="py-8 md:py-12">
      <ValidationView workspaceId={workspaceId} />
    </EditorialContainer>
  );
}
