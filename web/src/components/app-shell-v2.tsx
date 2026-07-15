"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  Home,
  PlayCircle,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { GavelLogo } from "@/components/gavel-logo";
import { HealthStatus } from "@/components/health-status";
import { heatCtaClass } from "@/lib/cta-classes";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/workspaces",
    label: "Workspaces",
    icon: Home,
    match: (pathname) => pathname === "/workspaces" || pathname.startsWith("/workspaces/"),
  },
  {
    href: "/history",
    label: "History",
    icon: Clock,
    match: (pathname) => pathname === "/history" || pathname.startsWith("/history/"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    match: (pathname) => pathname === "/settings",
  },
];

function activeRunId(pathname: string): string | null {
  const match = /^\/run\/([^/]+)/.exec(pathname);
  return match?.[1] ?? null;
}

function NavLink({
  item,
  pathname,
  compact = false,
}: {
  item: NavItem;
  pathname: string;
  compact?: boolean;
}) {
  const active = item.match(pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-ui font-sans text-sm font-medium transition-colors duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta",
        compact ? "min-h-11 flex-col justify-center gap-1 px-2 py-2 text-meta" : "min-h-11 px-3 py-2",
        active
          ? "bg-cta/10 text-cta shadow-[inset_3px_0_0_0_var(--cta)]"
          : "text-ink-muted hover:bg-paper-2 hover:text-ink",
      )}
    >
      <Icon className={cn("shrink-0", compact ? "size-5" : "size-4")} aria-hidden />
      <span className={compact ? "text-meta leading-none" : undefined}>{item.label}</span>
    </Link>
  );
}

function ActiveRunLink({ runId, compact = false }: { runId: string; compact?: boolean }) {
  return (
    <Link
      href={`/run/${runId}`}
      aria-current="page"
      className={cn(
        "flex items-center gap-3 rounded-ui font-sans text-sm font-medium",
        "bg-cta/10 text-cta shadow-[inset_3px_0_0_0_var(--cta)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta",
        compact
          ? "min-h-11 min-w-0 flex-1 flex-col justify-center gap-1 px-2 py-2 text-meta"
          : "mt-1 min-h-11 px-3 py-2",
      )}
    >
      <PlayCircle className={cn("shrink-0 text-cta", compact ? "size-5" : "size-4")} aria-hidden />
      <span className={cn("min-w-0 truncate", compact && "text-meta leading-none")}>
        {compact ? "Review" : "Current review"}
      </span>
    </Link>
  );
}

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const runId = activeRunId(pathname);

  return (
    <aside
      className={cn(
        "flex w-[var(--shell-width)] shrink-0 flex-col border-r border-rule-soft bg-card",
        className,
      )}
      aria-label="App navigation"
    >
      <div className="border-b border-rule-soft px-4 py-4">
        <Link
          href="/"
          className="inline-flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
        >
          <GavelLogo size={32} showName />
        </Link>
        <p className="mt-1 font-sans text-meta tracking-[var(--shell-nav-meta-tracking)] text-ink-subtle">
          Ideas on trial
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Main">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        {runId && <ActiveRunLink runId={runId} />}
      </nav>

      <div className="mt-auto space-y-3 border-t border-rule-soft p-4">
        <Link href="/workspaces/new" className={cn(heatCtaClass, "w-full justify-center shadow-none")}>
          New workspace
        </Link>
        <HealthStatus />
      </div>
    </aside>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const runId = activeRunId(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule-soft bg-card md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} compact />
        ))}
        {runId && <ActiveRunLink runId={runId} compact />}
      </div>
    </nav>
  );
}

/** Unified in-app content width; vertical spacing owned by each page. */
export function AppContentPane({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-4xl px-4 md:px-8",
        "pb-20 md:pb-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AppShellV2({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-0px)]">
      <AppSidebar className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <MobileBottomNav />
      </div>
    </div>
  );
}
