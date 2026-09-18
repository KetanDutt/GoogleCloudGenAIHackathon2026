"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { formatDate, isOverdue } from "@/lib/dates";
import { useWorkspaceMutation } from "@/lib/queries";
import type { Status, Task } from "@/lib/types";
import { Badge } from "./ui/Primitives";

export default function TaskRow({
  task,
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [optimisticStatus, setOptimisticStatus] = useState<Status | null>(null);
  const done = (optimisticStatus ?? task.status) === "completed";
  const toggle = useWorkspaceMutation((status: Status) =>
    api<Task>(`/tasks/${task.id}`, {
      method: "PATCH",
      body: { version: task.version, status },
    }),
  );
  return (
    <div className="task-row">
      <input
        type="checkbox"
        className="task-checkbox"
        checked={done}
        disabled={toggle.isPending}
        onChange={(event) => {
          const next = event.target.checked ? "completed" : "pending";
          setOptimisticStatus(next);
          toggle.mutate(next, { onSettled: () => setOptimisticStatus(null) });
        }}
        aria-label={`Mark ${task.title} ${done ? "incomplete" : "complete"}`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "break-words text-[13px] font-medium leading-relaxed",
            done && "text-muted line-through",
          )}
        >
          {task.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              "text-[11px]",
              isOverdue(task.due_at, done)
                ? "text-red-600 dark:text-red-300"
                : "text-muted",
            )}
          >
            {isOverdue(task.due_at, done) ? "Overdue · " : ""}
            {formatDate(task.due_at)}
          </span>
          <span className="text-[10px] text-line">•</span>
          <Badge
            tone={
              task.priority === "high"
                ? "amber"
                : task.priority === "medium"
                  ? "blue"
                  : "gray"
            }
          >
            {task.priority} priority
          </Badge>
        </div>
      </div>
      {onEdit && (
        <button
          className="icon-button"
          disabled={toggle.isPending}
          aria-label={`Edit ${task.title}`}
          onClick={onEdit}
        >
          <Pencil size={15} />
        </button>
      )}
      {onDelete && (
        <button
          className="icon-button hover:!text-red-600"
          disabled={toggle.isPending}
          aria-label={`Delete ${task.title}`}
          onClick={onDelete}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
