import { WorkspaceNav } from "@/features/workspace/workspace-nav";

export function ValidationPageChrome({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
          Validation
        </p>
        <h1 className="font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
          Validation
        </h1>
        <p className="max-w-prose font-sans text-body text-ink-muted">
          Collect evidence, test assumptions, and decide what to learn next before judges.
        </p>
      </header>

      <WorkspaceNav workspaceId={workspaceId} />

      {children}
    </div>
  );
}
