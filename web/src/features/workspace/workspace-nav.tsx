"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Phase 4: Case covers overview + validation routes; Pitch = worksheet; Reviews = judges. */
const TABS = [
  { slug: "", label: "Case", matchSlugs: ["", "validation"] },
  { slug: "worksheet", label: "Pitch", matchSlugs: ["worksheet"] },
  { slug: "judges", label: "Reviews", matchSlugs: ["judges"] },
] as const;

function sectionSlug(pathname: string, base: string): string {
  if (pathname === base) return "";
  if (!pathname.startsWith(`${base}/`)) return "";
  return pathname.slice(base.length + 1).split("/")[0] ?? "";
}

export function WorkspaceNav({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}`;
  const current = sectionSlug(pathname, base);

  return (
    <nav className="mb-8 flex flex-wrap gap-2 border-b border-rule-soft pb-3" aria-label="Workspace sections">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = (tab.matchSlugs as readonly string[]).includes(current);
        return (
          <Link
            key={tab.slug || "case"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-ui px-3 font-sans text-sm font-medium transition-colors duration-200",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta",
              active
                ? "bg-cta text-cta-fg"
                : "text-ink-muted hover:bg-paper-2 hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
