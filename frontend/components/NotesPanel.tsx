"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  NotebookPen,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/dates";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useWorkspace } from "@/lib/queries";
import type { Note, Page } from "@/lib/types";
import RecordEditor, { DeleteRecordDialog } from "./RecordEditor";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  SearchInput,
} from "./ui/Primitives";

export default function NotesPanel() {
  const params = useSearchParams();
  return (
    <NotesContent
      key={params.get("q") || ""}
      initialSearch={params.get("q") || ""}
    />
  );
}
function NotesContent({ initialSearch }: { initialSearch: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<Note | "new" | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const q = useDebouncedValue(search);
  const query = useWorkspace<Page<Note>>("notes", {
    q,
    limit: 12,
    offset: page * 12,
  });
  return (
    <>
      <PageHeader
        eyebrow="CAPTURE THE GOOD STUFF"
        title="A place for your thoughts"
        description="Meeting takeaways, passing ideas, and everything worth keeping."
        action={
          <Button onClick={() => setEditor("new")}>
            <Plus size={16} />
            New note
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {query.data
            ? `${query.data.total} ${query.data.total === 1 ? "note" : "notes"} in your collection`
            : "Your personal collection"}
        </p>
        <div className="w-full sm:w-72">
          <SearchInput
            label="Search notes"
            placeholder="Search your notes…"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(0);
            }}
          />
        </div>
      </div>
      {query.isPending ? (
        <LoadingState label="Opening your notebook…" />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.items.length ? (
        <div className="panel">
          <EmptyState
            icon={<NotebookPen size={26} />}
            title={
              search
                ? "No notes match that thought"
                : "Good ideas deserve a home"
            }
            description={
              search
                ? "Try another word or phrase."
                : "Jot something down, or use the assistant to turn a meeting into useful takeaways."
            }
            action={
              <Button variant="secondary" onClick={() => setEditor("new")}>
                <Plus size={15} />
                Write a note
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.items.map((note, index) => (
            <article key={note.id} className="note-card">
              <div className="mb-5 flex items-center justify-between">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${index % 3 === 0 ? "badge-amber" : index % 3 === 1 ? "badge-purple" : "badge-teal"}`}
                >
                  <NotebookPen size={18} />
                </div>
                <button
                  className="icon-button"
                  aria-label={`Delete ${note.title}`}
                  onClick={() => setDeleting(note)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <h2 className="mb-2 break-words text-base font-semibold">
                <button
                  className="text-left hover:text-accent"
                  onClick={() => setEditor(note)}
                >
                  {note.title}
                </button>
              </h2>
              <p className="line-clamp-4 whitespace-pre-line break-words text-[13px] leading-7 text-muted">
                {note.summary || note.content}
              </p>
              {note.action_items.length > 0 && (
                <p className="mt-3 text-xs font-medium text-accent">
                  {note.action_items.length} action{" "}
                  {note.action_items.length === 1 ? "item" : "items"} captured
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 pt-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">
                    {formatDate(note.updated_at)}
                  </span>
                  {note.summary && (
                    <Badge tone="purple">
                      <Sparkles size={10} />
                      AI summary
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => setEditor(note)}
                  className="icon-button"
                  aria-label={`Open ${note.title}`}
                >
                  <ArrowUpRight size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {query.data && query.data.total > 12 && (
        <div className="panel mt-5">
          <Pagination
            total={query.data.total}
            page={page}
            limit={12}
            onChange={setPage}
          />
        </div>
      )}
      <RecordEditor
        kind="notes"
        open={editor !== null}
        item={editor && editor !== "new" ? editor : undefined}
        onClose={() => setEditor(null)}
      />
      <DeleteRecordDialog
        kind="notes"
        item={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
