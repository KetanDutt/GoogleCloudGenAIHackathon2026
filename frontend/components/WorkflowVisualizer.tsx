"use client";

import { Check, CircleDot, GitBranch, LockKeyhole } from "lucide-react";
import type { ChatRun } from "@/lib/types";
import { Badge } from "./ui/Primitives";

export default function WorkflowVisualizer({
  run,
  loading,
}: {
  run?: ChatRun;
  loading: boolean;
}) {
  return (
    <aside className="space-y-5">
      <section className="panel p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-semibold">
            <GitBranch size={15} className="text-accent" />
            Behind the scenes
          </h2>
          {run && (
            <Badge tone="gray">
              {run.mode === "demo" ? "Demo" : "Vertex AI"}
            </Badge>
          )}
        </div>
        {loading ? (
          <p className="text-xs leading-6 text-muted" role="status">
            Preparing a proposal. This is not a live trace; the execution
            summary appears when the request finishes.
          </p>
        ) : run ? (
          <ol className="space-y-5">
            {run.trace.map((step, index) => (
              <li key={`${step.step}-${index}`} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  {index === run.trace.length - 1 &&
                  run.status === "pending" ? (
                    <CircleDot size={11} />
                  ) : (
                    <Check size={11} />
                  )}
                </span>
                <div>
                  <h3 className="text-[11px] font-semibold">{step.step}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    {step.step === "Review" && run.status === "applied"
                      ? "Confirmed and saved by you."
                      : step.step === "Review" && run.status === "discarded"
                        ? "Discarded. No workspace items were created."
                        : step.details}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="space-y-4">
            {[
              ["01", "Understand your request"],
              ["02", "Find the right specialist"],
              ["03", "Prepare a clear proposal"],
              ["04", "Wait for your review"],
            ].map(([number, label]) => (
              <div
                className="flex items-center gap-3 text-xs text-muted"
                key={number}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-[9px] font-medium">
                  {number}
                </span>
                {label}
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="rounded-xl border border-dashed border-line p-5">
        <LockKeyhole size={18} className="mb-3 text-accent" />
        <h2 className="text-xs font-semibold">You have the final say.</h2>
        <p className="mt-2 text-xs leading-6 text-muted">
          Nothing in your workspace changes until you confirm. AI can make
          mistakes — double-check names, dates, and timezones.
        </p>
        <p className="mt-3 text-[10px] leading-5 text-muted">
          No external calendar bookings or notifications are sent.
        </p>
      </div>
    </aside>
  );
}
