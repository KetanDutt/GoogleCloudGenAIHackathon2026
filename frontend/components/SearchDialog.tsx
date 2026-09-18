"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CircleCheck, NotebookPen, Search } from "lucide-react";
import { useWorkspace } from "@/lib/queries";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Note, Page, Task } from "@/lib/types";
import { Modal } from "./ui/Modal";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
} from "./ui/Primitives";

export default function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim());
  const router = useRouter();
  const tasks = useWorkspace<Page<Task>>("tasks", { q, limit: 5 }, open && !!q);
  const notes = useWorkspace<Page<Note>>("notes", { q, limit: 5 }, open && !!q);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const results = [
    ...(tasks.data?.items || []).map((item) => ({
      ...item,
      type: "Tasks",
      href: "/tasks",
      icon: CircleCheck,
    })),
    ...(notes.data?.items || []).map((item) => ({
      ...item,
      type: "Notes",
      href: "/notes",
      icon: NotebookPen,
    })),
  ];
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="search-trigger"
        aria-label="Search your workspace"
      >
        <Search size={16} />
        <span className="hidden sm:block">Search your workspace</span>
        <kbd className="ml-9 hidden rounded border border-line px-1.5 py-0.5 text-[10px] md:block">
          Ctrl K
        </kbd>
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Find a little clarity"
        description="Search your task titles and note contents."
      >
        <SearchInput
          label="Search workspace"
          placeholder="What are you looking for?"
          value={search}
          onChange={setSearch}
        />
        <div className="mt-4 max-h-80 overflow-y-auto">
          {!q ? (
            <EmptyState
              icon={<Search size={23} />}
              title="Everything, a little easier to find"
              description="Type to search your tasks and notes."
            />
          ) : tasks.isError || notes.isError ? (
            <ErrorState
              error={tasks.error || notes.error}
              retry={() => {
                void tasks.refetch();
                void notes.refetch();
              }}
            />
          ) : tasks.isPending || notes.isPending ? (
            <LoadingState label="Finding your items…" />
          ) : !results.length ? (
            <EmptyState
              title="No matches just yet"
              description="Try a shorter phrase or a different keyword."
            />
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-soft"
                onClick={() => {
                  router.push(
                    `${item.href}?q=${encodeURIComponent(item.title)}`,
                  );
                  setOpen(false);
                }}
              >
                <item.icon size={18} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="text-xs text-muted">{item.type}</span>
                </span>
                <ArrowUpRight size={15} className="text-muted" />
              </button>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
