"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";

import { getApiBaseUrl } from "@/lib/api/client";
import { RUN_PAGE_COPY } from "@/features/run/run-page-copy";

import { initialRunState, runReducer } from "./run-reducer.ts";
import type { ApiEventEnvelope, RunState, RunStatus } from "./types.ts";

const TERMINAL: RunStatus[] = ["completed", "failed", "cancelled"];

function parseEnvelope(raw: string): ApiEventEnvelope | null {
  try {
    return JSON.parse(raw) as ApiEventEnvelope;
  } catch {
    return null;
  }
}

export type RunStreamState = RunState & { sseReconnecting: boolean };

export function useRunStream(
  runId: string,
  options?: { enabled?: boolean; initialStatus?: RunStatus },
): RunStreamState {
  const enabled = options?.enabled ?? true;
  const [state, dispatch] = useReducer(
    runReducer,
    initialRunState(options?.initialStatus ?? "connecting"),
  );
  const [sseReconnecting, setSseReconnecting] = useState(false);
  const wasReconnectingRef = useRef(false);
  const sourceRef = useRef<EventSource | null>(null);
  const statusRef = useRef(state.status);

  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  const applyEnvelope = useCallback((envelope: ApiEventEnvelope) => {
    dispatch(envelope);
  }, []);

  useEffect(() => {
    if (TERMINAL.includes(state.status)) {
      sourceRef.current?.close();
    }
  }, [state.status]);

  useEffect(() => {
    if (!enabled || !runId) return;

    let closed = false;
    const source = new EventSource(`${getApiBaseUrl()}/api/runs/${runId}/events`);
    sourceRef.current = source;

    source.onopen = () => {
      if (wasReconnectingRef.current) {
        toast.success(RUN_PAGE_COPY.sseReconnected);
      }
      wasReconnectingRef.current = false;
      setSseReconnecting(false);
    };

    source.onmessage = (event) => {
      wasReconnectingRef.current = false;
      setSseReconnecting(false);
      const envelope = parseEnvelope(event.data);
      if (envelope) applyEnvelope(envelope);
    };

    source.onerror = () => {
      if (closed) {
        source.close();
        return;
      }
      if (!TERMINAL.includes(statusRef.current)) {
        wasReconnectingRef.current = true;
        setSseReconnecting(true);
      }
      // ponytail: EventSource auto-reconnects with Last-Event-ID from id: frames
    };

    return () => {
      closed = true;
      source.close();
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
    };
  }, [runId, enabled, applyEnvelope]);

  return { ...state, sseReconnecting };
}

export type { RunState };
