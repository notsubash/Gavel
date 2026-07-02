"use client";

import { isUiShellV2Enabled } from "@/lib/feature-flags";

import { AppContentPane, AppShellV2 } from "./app-shell-v2";
import { AppFooter, AppHeader } from "./app-shell";

export function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isUiShellV2Enabled()) {
    return (
      <>
        <AppHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <AppFooter />
      </>
    );
  }

  return (
    <AppShellV2>
      <main id="main" className="min-h-full flex-1 bg-paper">
        <AppContentPane>{children}</AppContentPane>
      </main>
    </AppShellV2>
  );
}
