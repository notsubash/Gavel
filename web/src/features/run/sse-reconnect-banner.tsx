import { WifiOff } from "lucide-react";

import type { RunStatus } from "@/lib/sse/types";

import { RUN_PAGE_COPY } from "./run-page-copy";

function isTerminalStatus(status: RunStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function SseReconnectBanner({
  reconnecting,
  status,
}: {
  reconnecting: boolean;
  status: RunStatus;
}) {
  if (!reconnecting || isTerminalStatus(status)) return null;

  return (
    <div
      className="mt-4 flex items-start gap-3 border border-conditional/40 bg-conditional/5 p-4"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="mt-0.5 size-5 shrink-0 text-conditional" aria-hidden />
      <p className="font-sans text-sm text-ink">{RUN_PAGE_COPY.sseReconnecting}</p>
    </div>
  );
}
