"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import clsx from "clsx";
import { useWorkspace } from "@/lib/queries";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Page, Task } from "@/lib/types";
import RecordEditor, { DeleteRecordDialog } from "./RecordEditor";
import TaskRow from "./TaskRow";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  SearchInput,
} from "./ui/Primitives";

export default function TaskList() {
  const params = useSearchParams();
  return (
    <TaskListContent
      key={params.get("q") || ""}
      initialSearch={params.get("q") || ""}
    />
  );
}
function TaskListContent({ initialSearch }: { initialSearch: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState("all");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<Task | "new" | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const q = useDebouncedValue(search);
  const query = useWorkspace<Page<Task>>("tasks", {
    q,
    limit: 20,
    offset: page * 20,
    priority,
    status: filter === "all" || filter === "overdue" ? undefined : filter,
    overdue: filter === "overdue" ? true : undefined,
  });
  const filters = [
    ["all", "All tasks"],
    ["pending", "To do"],
    ["completed", "Completed"],
    ["overdue", "Overdue"],
  ];
  return (
    <>
      <PageHeader
        eyebrow="ONE STEP AT A TIME"
        title="Your tasks"
        description="Big plans begin with small, clear next steps."
        action={
          <Button onClick={() => setEditor("new")}>
            <Plus size={16} />
            New task
          </Button>
        }
      />
      <div className="panel overflow-hidden">
        <div className="toolbar">
          <div
            className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-canvas p-1"
            role="group"
            aria-label="Filter tasks"
          >
            {filters.map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  setFilter(value);
                  setPage(0);
                }}
                aria-pressed={filter === value}
                className={clsx("tab", filter === value && "active")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              label="Search tasks"
              placeholder="Search tasks…"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(0);
              }}
            />
            <div className="relative">
              <SlidersHorizontal
                size={14}
                className="pointer-events-none absolute left-3 top-3.5 text-muted"
              />
              <select
                aria-label="Filter by priority"
                className="input !pl-8 !text-xs"
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <button
              className="icon-button"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
              aria-label="Refresh tasks"
            >
              <RefreshCw
                size={16}
                className={clsx(query.isFetching && "animate-spin")}
              />
            </button>
          </div>
        </div>
        <div className="border-t border-line">
          {query.isPending ? (
            <LoadingState label="Gathering your next steps…" />
          ) : query.isError ? (
            <div className="p-5">
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            </div>
          ) : !query.data.items.length ? (
            <EmptyState
              icon={<CircleCheck size={26} />}
              title={
                search || filter !== "all" || priority
                  ? "A clean slate in this view"
                  : "Your next chapter starts here"
              }
              description={
                search || filter !== "all" || priority
                  ? "Try a different search or filter to find your tasks."
                  : "Add your first task, or ask the assistant to help turn a goal into a plan."
              }
              action={
                <Button variant="secondary" onClick={() => setEditor("new")}>
                  <Plus size={15} />
                  Create a task
                </Button>
              }
            />
          ) : (
            query.data.items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={() => setEditor(task)}
                onDelete={() => setDeleting(task)}
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
      <p className="mt-4 text-xs text-muted">
        You can complete, reopen, or edit any task. Your due dates stay with it.
      </p>
      <RecordEditor
        kind="tasks"
        open={editor !== null}
        item={editor && editor !== "new" ? editor : undefined}
        onClose={() => setEditor(null)}
      />
      <DeleteRecordDialog
        kind="tasks"
        item={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
