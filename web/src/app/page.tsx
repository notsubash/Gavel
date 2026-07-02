import { EditorialContainer } from "@/components/app-shell";
import { isUiShellV2Enabled } from "@/lib/feature-flags";
import { HOME_COPY } from "@/features/run/run-page-copy";
import { IdeaForm } from "@/features/submit/idea-form";
import { cn } from "@/lib/utils";

type HomeProps = {
  searchParams: Promise<{ refine?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const shellV2 = isUiShellV2Enabled();
  return (
    <EditorialContainer className={shellV2 ? "py-8 md:py-12" : "py-16 md:py-24 lg:py-32"}>
      <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
        {HOME_COPY.eyebrow}
      </p>
      <h1
        className={cn(
          "mt-4 font-sans font-semibold leading-[1.1] tracking-tight text-ink",
          shellV2
            ? "text-display-home md:text-display-md"
            : "text-display-md md:text-display-lg lg:text-display-xl",
        )}
      >
        {HOME_COPY.headline}
      </h1>
      <p className="mt-6 max-w-prose font-sans text-body leading-relaxed text-ink-muted md:mt-8 md:text-lg">
        {HOME_COPY.lead}
      </p>
      <IdeaForm refineRunId={params.refine ?? null} />
    </EditorialContainer>
  );
}
