import { EditorialContainer } from "@/components/app-shell";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function ValidationPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <EditorialContainer className="py-8 md:py-12">
      <p className="font-sans text-body text-ink-muted">
        Validation checklist and assumption board ship in Phase 2.{" "}
        <a href={`/workspaces/${workspaceId}`} className="text-cta underline">
          Back to overview
        </a>
      </p>
    </EditorialContainer>
  );
}
