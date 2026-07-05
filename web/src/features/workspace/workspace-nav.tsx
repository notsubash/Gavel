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
    <nav className="mb-8 flex flex-wrap gap-2 border-b border-line pb-3" aria-label="Workspace sections">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug
          ? pathname.startsWith(`${base}/${tab.slug}`)
          : pathname === base;
        return (
          <Link
            key={tab.slug || "overview"}
            href={href}
            className={cn(
              "rounded-sm px-3 py-1.5 font-sans text-sm font-medium transition-colors",
              active
                ? "bg-ink text-paper"
                : "text-ink-muted hover:bg-paper-warm hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
