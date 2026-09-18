"use client";

import { useState } from "react";
import { Bell, Info, Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { formatDate, isOverdue } from "@/lib/dates";
import { useWorkspace, useWorkspaceMutation } from "@/lib/queries";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Page, Reminder, Status } from "@/lib/types";
import RecordEditor, { DeleteRecordDialog } from "@/components/RecordEditor";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  SearchInput,
} from "@/components/ui/Primitives";

export default function RemindersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<Reminder | "new" | null>(null);
  const [deleting, setDeleting] = useState<Reminder | null>(null);
  const q = useDebouncedValue(search);
  const query = useWorkspace<Page<Reminder>>("reminders", {
    q,
    status: status || undefined,
    limit: 20,
    offset: page * 20,
  });
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE LESS TO REMEMBER"
        title="Keep it on your radar"
        description="Small nudges for the things you don’t want to lose track of."
        action={
          <Button onClick={() => setEditor("new")}>
            <Plus size={16} />
            New reminder
          </Button>
        }
      />
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
        <Info size={17} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-xs leading-6 text-muted">
          <strong className="font-semibold text-ink">
            A helpful heads-up:
          </strong>{" "}
          these reminders live in your workspace. Email, push notifications, and
          background alerts are not sent.
        </p>
      </div>
      <div className="panel overflow-hidden">
        <div className="toolbar">
          <div
            className="flex gap-1 rounded-lg bg-canvas p-1"
            role="group"
            aria-label="Filter reminders"
          >
            {[
              ["pending", "On your radar"],
              ["completed", "Done"],
              ["", "All"],
            ].map(([value, label]) => (
              <button
                className={clsx("tab", status === value && "active")}
                key={value}
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value);
                  setPage(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <SearchInput
            label="Search reminders"
            placeholder="Search reminders…"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(0);
            }}
          />
        </div>
        <div className="border-t border-line">
          {query.isPending ? (
            <LoadingState />
          ) : query.isError ? (
            <div className="p-5">
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            </div>
          ) : !query.data.items.length ? (
            <EmptyState
              icon={<Bell size={25} />}
              title="One less thing on your mind"
              description="No reminders in this view. Add a gentle nudge for something that matters."
              action={
                <Button variant="secondary" onClick={() => setEditor("new")}>
                  <Plus size={14} />
                  Add a reminder
                </Button>
              }
            />
          ) : (
            query.data.items.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                onEdit={() => setEditor(reminder)}
                onDelete={() => setDeleting(reminder)}
              />
            ))
          )}
        </div>
        {query.data && (
          <Pagination
            total={query.data.total}
            page={page}
            limit={20}
            onChange={setPage}
          />
        )}
      </div>
      <RecordEditor
        kind="reminders"
        open={editor !== null}
        item={editor && editor !== "new" ? editor : undefined}
        onClose={() => setEditor(null)}
      />
      <DeleteRecordDialog
        kind="reminders"
        item={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
function ReminderRow({
  reminder,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [optimisticStatus, setOptimisticStatus] = useState<Status | null>(null);
  const done = (optimisticStatus ?? reminder.status) === "completed";
  const toggle = useWorkspaceMutation((status: Status) =>
    api<Reminder>(`/reminders/${reminder.id}`, {
      method: "PATCH",
      body: {
        version: reminder.version,
        status,
      },
    }),
  );
  return (
    <article className="task-row">
      <input
        type="checkbox"
        className="task-checkbox"
        checked={done}
        onChange={(event) => {
          const next = event.target.checked ? "completed" : "pending";
          setOptimisticStatus(next);
          toggle.mutate(next, { onSettled: () => setOptimisticStatus(null) });
        }}
        disabled={toggle.isPending}
        aria-label={`Mark ${reminder.title} ${done ? "incomplete" : "complete"}`}
      />
      <div className="min-w-0 flex-1">
        <h2
          className={clsx(
            "break-words text-sm font-medium",
            done && "text-muted line-through",
          )}
        >
          {reminder.title}
        </h2>
        {reminder.suggestion && (
          <p className="mt-1 break-words text-xs leading-6 text-muted">
            {reminder.suggestion}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge
            tone={
              reminder.urgency === "high"
                ? "amber"
                : reminder.urgency === "medium"
                  ? "blue"
                  : "gray"
            }
          >
            {reminder.urgency} urgency
          </Badge>
          <span
            className={clsx(
              "text-[10px]",
              isOverdue(reminder.due_at, done)
                ? "text-red-600 dark:text-red-300"
                : "text-muted",
            )}
          >
            {isOverdue(reminder.due_at, done) ? "Overdue · " : ""}
            {formatDate(reminder.due_at, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
      <button
        className="icon-button"
        aria-label={`Edit ${reminder.title}`}
        onClick={onEdit}
      >
        <Pencil size={15} />
      </button>
      <button
        className="icon-button"
        aria-label={`Delete ${reminder.title}`}
        onClick={onDelete}
      >
        <Trash2 size={15} />
      </button>
    </article>
  );
}
