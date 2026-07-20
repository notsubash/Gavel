"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";

import { SETTINGS_COPY } from "@/features/run/run-page-copy";
import {
  ADVANCED_SETTINGS_STORAGE_KEY,
  DEFAULT_ADVANCED_SETTINGS,
  loadAdvancedSettings,
  saveAdvancedSettings,
  type AdvancedSettings,
} from "@/lib/settings/advanced-settings";
import { Label } from "@/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Slider } from "@/ui/slider";
import { Switch } from "@/ui/switch";

const SETTINGS_CHANGED = "gavel-advanced-settings";

// ponytail: cache required — loadAdvancedSettings() returns a new object each call
let snapshot: AdvancedSettings | null = null;

function subscribeSettings(onChange: () => void) {
  const refresh = () => {
    snapshot = loadAdvancedSettings();
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === ADVANCED_SETTINGS_STORAGE_KEY || event.key === null) refresh();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SETTINGS_CHANGED, refresh);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SETTINGS_CHANGED, refresh);
  };
}

function getSettingsSnapshot() {
  snapshot ??= loadAdvancedSettings();
  return snapshot;
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-rule-soft pt-8 first:border-t-0 first:pt-0">
      <h2 className="font-sans text-section font-semibold text-ink">{title}</h2>
      <p className="mt-2 max-w-prose font-sans text-meta text-ink-muted">{description}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

export function AdvancedSettingsPanel() {
  const settings = useSyncExternalStore(
    subscribeSettings,
    getSettingsSnapshot,
    () => DEFAULT_ADVANCED_SETTINGS,
  );

  const patch = (partial: Partial<AdvancedSettings>) => {
    snapshot = saveAdvancedSettings(partial);
    window.dispatchEvent(new Event(SETTINGS_CHANGED));
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
          Maintainer
        </p>
        <h1 className="mt-2 font-sans text-section font-semibold text-ink">
          Advanced settings
        </h1>
        <p className="mt-3 max-w-prose font-sans text-body text-ink-muted">
          {SETTINGS_COPY.intro}{" "}
          <Link href="/workspaces" className="font-semibold text-ink underline-offset-4 hover:underline">
            Ideas
          </Link>
          .
        </p>
      </header>

      <SettingsSection
        title={SETTINGS_COPY.newReviewDefaults}
        description={SETTINGS_COPY.newReviewDescription}
      >
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-model-runtime">Model runtime</Label>
            <Select
              value={settings.model_runtime}
              onValueChange={(value: "local" | "deepseek") =>
                patch({ model_runtime: value })
              }
            >
              <SelectTrigger id="settings-model-runtime">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deepseek">DeepSeek (paid, faster)</SelectItem>
                <SelectItem value="local">Local (free, slower)</SelectItem>
              </SelectContent>
            </Select>
            <p className="font-sans text-xs text-ink-muted">
              Which LLM backend runs the judges. Local costs $0 but needs Ollama running.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <Label htmlFor="settings-debate-rounds">Debate rounds</Label>
              <span className="font-mono text-sm font-medium tabular-nums text-ink">
                {settings.max_debate_rounds}
              </span>
            </div>
            <Slider
              id="settings-debate-rounds"
              min={1}
              max={5}
              step={1}
              value={[settings.max_debate_rounds]}
              onValueChange={([value]) => patch({ max_debate_rounds: value })}
              aria-label="Debate rounds"
            />
            <p className="font-sans text-xs text-ink-muted">
              How many back-and-forth debate rounds before the final synthesis (1–5).
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border border-rule-soft bg-paper-2 px-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="settings-web-search">Web search</Label>
            <p className="font-sans text-xs text-ink-muted">
              Let judges pull live research snippets into the review (extra latency and cost when
              using DeepSeek).
            </p>
          </div>
          <Switch
            id="settings-web-search"
            checked={settings.enable_web_search}
            onCheckedChange={(checked) => patch({ enable_web_search: checked })}
            aria-label={SETTINGS_COPY.webSearchLabel}
          />
        </div>
      </SettingsSection>

      <p className="font-sans text-xs text-ink-subtle">
        Run layout is workflow-first. Maintainer overrides:{" "}
        <span className="font-mono">?fold=a</span> (judges first) or{" "}
        <span className="font-mono">?fold=b</span> (workflow first) on a run URL;{" "}
        <span className="font-mono">?debug=1</span> for the lens-quality badge.
      </p>
    </div>
  );
}
