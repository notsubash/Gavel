"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "validation", label: "Validation" },
  { slug: "worksheet", label: "Worksheet" },
  { slug: "judges", label: "Judges" },
] as const;

export function WorkspaceNav({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}`;

  return (
    <nav className="mb-8 flex flex-wrap gap-2 border-b border-rule-soft pb-3" aria-label="Workspace sections">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug
          ? pathname.startsWith(`${base}/${tab.slug}`)
          : pathname === base;
        return (
          <Link
            key={tab.slug || "overview"}
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
