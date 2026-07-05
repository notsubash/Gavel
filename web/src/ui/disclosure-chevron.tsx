import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** Shared rotate-on-open chevron for `<details>` / disclosure summaries. */
export function DisclosureChevron({ className }: { className?: string }) {
  return (
    <ChevronDown
      className={cn(
        "size-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none group-open:rotate-180",
        className,
      )}
      aria-hidden
    />
  );
}
