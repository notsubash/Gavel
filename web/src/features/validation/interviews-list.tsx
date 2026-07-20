"use client";

import type { InterviewNote } from "@/lib/api/workspaces";
import { EMPTY_COPY } from "@/features/run/run-page-copy";
import { Card } from "@/ui/card";

export function InterviewsList({ interviews }: { interviews: InterviewNote[] }) {
  return (
    <section aria-labelledby="interviews-heading">
      <h2 id="interviews-heading" className="font-sans text-section font-semibold text-ink">
        Interviews ({interviews.length})
      </h2>
      {interviews.length === 0 ? (
        <Card className="mt-3 p-5">
          <p className="font-sans text-body text-ink-muted">{EMPTY_COPY.interviews}</p>
        </Card>
      ) : (
        <ul className="mt-3 space-y-2">
          {interviews.map((interview) => (
            <li key={interview.id}>
              <Card className="p-4">
                <p className="font-sans text-body font-medium text-ink">{interview.person_label}</p>
                <p className="mt-1 line-clamp-3 font-sans text-sm text-ink-muted">
                  {interview.notes}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
