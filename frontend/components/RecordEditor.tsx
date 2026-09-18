"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { browserTimezone, toISO, toLocalInput } from "@/lib/dates";
import { useWorkspaceMutation } from "@/lib/queries";
import type { Kind, Priority, WorkspaceItem } from "@/lib/types";
import { Modal, ConfirmDialog } from "./ui/Modal";
import { Button, FormError } from "./ui/Primitives";

const labels: Record<Kind, string> = {
  tasks: "task",
  notes: "note",
  events: "event",
  reminders: "reminder",
};

type EditorProps = {
  kind: Kind;
  item?: WorkspaceItem;
  open: boolean;
  onClose: () => void;
  initialDate?: string;
};
export default function RecordEditor({
  kind,
  item,
  open,
  onClose,
  initialDate,
}: EditorProps) {
  const mutation = useWorkspaceMutation(
    (payload: object) =>
      api<WorkspaceItem>(`/${kind}${item ? `/${item.id}` : ""}`, {
        method: item ? "PATCH" : "POST",
        body: item ? { ...payload, version: item.version } : payload,
      }),
    `${labels[kind][0].toUpperCase()}${labels[kind].slice(1)} ${item ? "updated" : "created"}`,
  );
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!value && !mutation.isPending) onClose();
      }}
      title={`${item ? "Edit" : "New"} ${labels[kind]}`}
      description={
        kind === "reminders"
          ? "Keep something on your radar. Reminders are in-app only, not notifications."
          : kind === "events"
            ? "Make a little time for what matters. This event stays in your workspace."
            : kind === "notes"
              ? "A home for ideas, meeting notes, and things worth remembering."
              : "One clear next step is a great place to start."
      }
      wide={kind === "notes"}
    >
      <EditorForm
        key={`${kind}-${item?.id || "new"}`}
        kind={kind}
        item={item}
        initialDate={initialDate}
        busy={mutation.isPending}
        onCancel={onClose}
        onSave={async (body) => {
          await mutation.mutateAsync(body);
          onClose();
        }}
      />
    </Modal>
  );
}

function EditorForm({
  kind,
  item,
  initialDate,
  busy,
  onCancel,
  onSave,
}: {
  kind: Kind;
  item?: WorkspaceItem;
  initialDate?: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (body: object) => Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title || "");
  const [due, setDue] = useState(
    item && "due_at" in item ? toLocalInput(item.due_at) : "",
  );
  const [priority, setPriority] = useState<Priority>(
    item && "priority" in item
      ? item.priority
      : item && "urgency" in item
        ? item.urgency
        : "medium",
  );
  const [content, setContent] = useState(
    item && "content" in item ? item.content : "",
  );
  const [description, setDescription] = useState(
    item && "description" in item
      ? item.description
      : item && "suggestion" in item
        ? item.suggestion
        : "",
  );
  const [start, setStart] = useState(
    item && "start_time" in item
      ? toLocalInput(item.start_time)
      : initialDate
        ? `${initialDate}T09:00`
        : "",
  );
  const [end, setEnd] = useState(
    item && "end_time" in item
      ? toLocalInput(item.end_time)
      : initialDate
        ? `${initialDate}T10:00`
        : "",
  );
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (busy) return;
    try {
      const trimmed = title.trim();
      if (!trimmed) throw new Error("Give this item a title first.");
      let body: object;
      if (kind === "tasks")
        body = {
          title: trimmed,
          due_at: toISO(
            due,
            item && "due_at" in item ? item.due_at : undefined,
          ),
          priority,
        };
      else if (kind === "notes") {
        if (!content.trim())
          throw new Error("Your note needs a little content.");
        body = { title: trimmed, content: content.trim() };
      } else if (kind === "events") {
        const startTime = toISO(
            start,
            item && "start_time" in item ? item.start_time : undefined,
          ),
          endTime = toISO(
            end,
            item && "end_time" in item ? item.end_time : undefined,
          );
        if (!startTime || !endTime || new Date(endTime) <= new Date(startTime))
          throw new Error("Choose an end time after the start time.");
        body = {
          title: trimmed,
          start_time: startTime,
          end_time: endTime,
          description,
        };
      } else
        body = {
          title: trimmed,
          due_at: toISO(
            due,
            item && "due_at" in item ? item.due_at : undefined,
          ),
          urgency: priority,
          suggestion: description,
        };
      await onSave(body);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label" htmlFor="record-title">
          Title
        </label>
        <input
          id="record-title"
          className="input"
          autoFocus
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            kind === "tasks"
              ? "What would you like to get done?"
              : "Give it a clear, helpful name"
          }
        />
      </div>
      {kind === "notes" && (
        <>
          <div>
            <label className="label" htmlFor="note-content">
              Your note
            </label>
            <textarea
              id="note-content"
              className="input min-h-56 resize-y leading-relaxed"
              required
              maxLength={8000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start with a thought…"
            />
            <p className="field-hint">
              {content.length.toLocaleString()} / 8,000 characters
            </p>
          </div>
          {item && "summary" in item && item.summary && (
            <div className="rounded-xl bg-soft p-4">
              <p className="mb-1 text-xs font-semibold">AI summary</p>
              <p className="text-sm leading-relaxed text-muted">
                {item.summary}
              </p>
              <p className="field-hint">
                Saving edited content clears its old AI summary and action
                items.
              </p>
            </div>
          )}
        </>
      )}
      {(kind === "tasks" || kind === "reminders") && (
        <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
          <div>
            <label className="label" htmlFor="record-due">
              Due date{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="record-due"
              type="datetime-local"
              className="input"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            <p className="field-hint">Local time · {browserTimezone()}</p>
          </div>
          <div>
            <label className="label" htmlFor="record-priority">
              {kind === "tasks" ? "Priority" : "Urgency"}
            </label>
            <select
              id="record-priority"
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      )}
      {kind === "events" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="event-start">
                Starts
              </label>
              <input
                id="event-start"
                type="datetime-local"
                className="input"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="event-end">
                Ends
              </label>
              <input
                id="event-end"
                type="datetime-local"
                className="input"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <p className="field-hint">
            All times are in your browser timezone: {browserTimezone()}.
          </p>
        </>
      )}
      {(kind === "events" || kind === "reminders") && (
        <div>
          <label className="label" htmlFor="record-description">
            {kind === "events" ? "Description" : "A little context"}{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="record-description"
            className="input min-h-24 resize-y"
            maxLength={kind === "events" ? 2000 : 500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      )}
      <FormError message={error} />
      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {item ? "Save changes" : `Create ${labels[kind]}`}
        </Button>
      </div>
    </form>
  );
}

export function DeleteRecordDialog({
  kind,
  item,
  onClose,
}: {
  kind: Kind;
  item: WorkspaceItem | null;
  onClose: () => void;
}) {
  const mutation = useWorkspaceMutation(
    () =>
      api(`/${kind}/${item?.id}?version=${item?.version}`, {
        method: "DELETE",
      }),
    `${labels[kind][0].toUpperCase()}${labels[kind].slice(1)} deleted`,
  );
  return (
    <ConfirmDialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Delete this ${labels[kind]}?`}
      description={`“${item?.title || "This item"}” will be permanently removed. This cannot be undone.`}
      onConfirm={() => mutation.mutateAsync()}
    />
  );
}
