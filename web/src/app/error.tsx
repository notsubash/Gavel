"use client";

import { EditorialContainer } from "@/components/app-shell";
import { heatCtaClass } from "@/lib/cta-classes";
import { isUiShellV2Enabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const shellV2 = isUiShellV2Enabled();

  return (
    <EditorialContainer className={shellV2 ? "py-10 md:py-12" : "py-16 md:py-20"}>
      <div role="alert">
        <h1
          className={cn(
            "font-sans font-semibold text-ink",
            shellV2 ? "text-section" : "text-title",
          )}
        >
          Review could not load
        </h1>
        <p className="mt-3 max-w-prose font-sans text-body text-ink-muted">
          {error.message || "Something interrupted this review session."}
        </p>
        <button type="button" onClick={reset} className={cn("mt-6", heatCtaClass, "px-6")}>
          Try again
        </button>
      </div>
    </EditorialContainer>
  );
}
