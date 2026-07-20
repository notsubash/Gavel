"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { secondaryCtaClass } from "@/lib/cta-classes";
import { cn } from "@/lib/utils";

/**
 * Shared ⋯ overflow menu (Phase 5). One behavior app-wide:
 * secondary trigger, absolute panel, min 44px items.
 */
export function MoreMenu({
  label = "More",
  iconOnly = false,
  align = "left",
  children,
  className,
}: {
  label?: string;
  iconOnly?: boolean;
  align?: "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cn("relative", className)}>
      <summary
        className={cn(
          secondaryCtaClass,
          "list-none gap-2 [&::-webkit-details-marker]:hidden",
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden />
        {iconOnly ? <span className="sr-only">{label}</span> : label}
      </summary>
      <div
        className={cn(
          "absolute z-10 mt-1 min-w-44 rounded-ui border border-rule-soft bg-card py-1 shadow-soft",
          align === "right" ? "right-0" : "left-0",
        )}
        role="group"
        aria-label={label}
      >
        {children}
      </div>
    </details>
  );
}

const itemClass =
  "flex w-full min-h-11 items-center gap-2 px-4 py-2 font-sans text-sm text-ink hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cta disabled:pointer-events-none disabled:opacity-50";

export function MoreMenuItem({
  children,
  href,
  onClick,
  disabled = false,
  className,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  if (href) {
    return (
      <Link
        href={href}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        className={cn(itemClass, disabled && "pointer-events-none opacity-50", className)}
        onClick={disabled ? (e) => e.preventDefault() : undefined}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={disabled || undefined}
      className={cn(itemClass, "text-left", className)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
