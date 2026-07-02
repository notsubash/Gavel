import type { ExperimentStatus } from "./experiment.ts";

const STORAGE_KEY = "rms-experiment-status";

type StoredExperimentState = {
  status: ExperimentStatus;
  updatedAt: string;
};

function readAll(): Record<string, StoredExperimentState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredExperimentState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, StoredExperimentState>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getStoredExperimentStatus(runId: string): ExperimentStatus | null {
  const entry = readAll()[runId];
  return entry?.status ?? null;
}

export function setStoredExperimentStatus(
  runId: string,
  status: ExperimentStatus,
): void {
  const data = readAll();
  data[runId] = { status, updatedAt: new Date().toISOString() };
  writeAll(data);
}
