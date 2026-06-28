import Link from "next/link";

import { EditorialContainer } from "@/components/app-shell";

export const metadata = {
  title: "Dev gallery — Roast My Startup",
};

export default function DevGalleryPage() {
  return (
    <EditorialContainer className="py-12 md:py-16">
      <div className="col-span-12">
        <p className="font-sans text-sm font-semibold uppercase tracking-widest text-heat-ink">
          Phase 0
        </p>
        <h1 className="mt-2 font-serif text-[28px] font-semibold text-ink md:text-[44px]">
          Component gallery
        </h1>
        <p className="mt-4 max-w-prose font-sans text-ink-muted">
          Empty for now. Phase 1 will render every primitive and signature component
          here in all states — loading, empty, error, success.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center border-2 border-ink bg-card px-4 py-2 font-sans text-sm font-semibold text-ink shadow-hard transition-[transform,box-shadow] duration-150 hover:translate-x-px hover:translate-y-px hover:shadow-none"
        >
          Back home
        </Link>
      </div>
    </EditorialContainer>
  );
}
