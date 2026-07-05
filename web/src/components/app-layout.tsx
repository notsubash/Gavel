"use client";

import { AppContentPane, AppShellV2 } from "./app-shell-v2";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShellV2>
      <main id="main" className="min-h-full flex-1 bg-paper">
        <AppContentPane>{children}</AppContentPane>
      </main>
    </AppShellV2>
  );
}
