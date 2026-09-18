"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { api, queryString } from "@/lib/api";
import {
  browserTimezone,
  dayKey,
  eventsByDay,
  formatDate,
  formatTime,
  monthGrid,
  moveMonth,
} from "@/lib/dates";
import { useSession } from "@/lib/queries";
import type { CalendarEvent, Page } from "@/lib/types";
import RecordEditor, { DeleteRecordDialog } from "./RecordEditor";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "./ui/Primitives";

export default function CalendarView() {
  const { data: session } = useSession();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const [editor, setEditor] = useState<CalendarEvent | "new" | null>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  const days = useMemo(() => monthGrid(month), [month]);
  const from = days[0].toISOString();
  const last = days[days.length - 1];
  const to = new Date(
    last.getFullYear(),
    last.getMonth(),
    last.getDate() + 1,
  ).toISOString();
  const query = useInfiniteQuery({
    queryKey: ["workspace", session?.user.id, "events", from, to],
    queryFn: ({ pageParam, signal }) =>
      api<Page<CalendarEvent>>(
        `/events${queryString({ from_time: from, to_time: to, limit: 100, offset: pageParam })}`,
        { signal },
      ),
    initialPageParam: 0,
    getNextPageParam: (page) =>
      page.offset + page.limit < page.total
        ? page.offset + page.limit
        : undefined,
    enabled: !!session,
  });
  const byDay = useMemo(
    () =>
      eventsByDay(query.data?.pages.flatMap((page) => page.items) || [], days),
    [query.data, days],
  );
  const selectedEvents = byDay.get(selected) || [];
  function changeMonth(offset: number) {
    const next = moveMonth(month, offset);
    setMonth(next);
    setSelected(dayKey(next));
  }
  return (
    <>
      <PageHeader
        eyebrow="MAKE SPACE FOR WHAT MATTERS"
        title="Your calendar"
        description="A little structure for your day. A little room to breathe."
        action={
          <Button onClick={() => setEditor("new")}>
            <Plus size={16} />
            New event
          </Button>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_290px]">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
            <h2 className="text-lg font-semibold">
              {formatDate(month.toISOString(), {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                className="mr-2 !min-h-8 !py-1.5 !text-xs"
                onClick={() => {
                  setMonth(new Date());
                  setSelected(dayKey(new Date()));
                }}
              >
                Today
              </Button>
              <button
                className="icon-button"
                aria-label="Previous month"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next month"
                onClick={() => changeMonth(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-t border-line bg-canvas">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="py-3 text-center text-[10px] font-medium text-muted"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = dayKey(day),
                events = byDay.get(key) || [],
                isToday = key === dayKey(new Date()),
                isSelected = key === selected;
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  aria-label={`${formatDate(day.toISOString(), { month: "long", day: "numeric", year: "numeric" })}, ${events.length} events`}
                  aria-pressed={isSelected}
                  className={clsx(
                    "relative min-h-[70px] min-w-0 border-t border-line p-1.5 text-left transition-colors sm:min-h-[100px] sm:p-2",
                    day.getMonth() !== month.getMonth() &&
                      "bg-canvas text-muted",
                    isSelected
                      ? "bg-accent-soft ring-1 ring-inset ring-accent/35"
                      : "hover:bg-soft",
                  )}
                >
                  <span
                    className={clsx(
                      "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                      isToday
                        ? "bg-accent font-semibold text-white dark:text-[#17352d]"
                        : "font-medium",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <div className="hidden space-y-1 sm:block">
                    {events.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className="block truncate rounded bg-accent-soft px-1.5 py-1 text-[9px] font-medium text-accent"
                      >
                        {event.title}
                      </span>
                    ))}
                    {events.length > 2 && (
                      <span className="block text-[9px] text-muted">
                        +{events.length - 2} more
                      </span>
                    )}
                  </div>
                  {events.length > 0 && (
                    <span className="ml-2 block h-1.5 w-1.5 rounded-full bg-accent sm:hidden" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
            <p className="text-[10px] text-muted">
              {browserTimezone()} · Workspace calendar, not Google Calendar
            </p>
            {query.isFetching && (
              <span className="text-[10px] text-muted" role="status">
                Updating…
              </span>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow mb-1.5">YOUR DAY AT A GLANCE</p>
              <h2 className="text-base font-semibold">
                {formatDate(`${selected}T12:00:00`, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </h2>
            </div>
            <Badge tone="teal">{selectedEvents.length} events</Badge>
          </div>
          {query.isPending ? (
            <LoadingState label="Opening your calendar…" />
          ) : query.isError ? (
            <div className="p-4">
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            </div>
          ) : selectedEvents.length ? (
            <div className="divide-y divide-line">
              {selectedEvents.map((event) => (
                <article key={event.id} className="p-5">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] text-accent">
                    <Clock3 size={12} />
                    {formatTime(event.start_time)} –{" "}
                    {formatTime(event.end_time)}
                  </div>
                  <h3 className="break-words text-[13px] font-semibold">
                    {event.title}
                  </h3>
                  {dayKey(new Date(event.start_time)) !==
                    dayKey(new Date(event.end_time)) && (
                    <p className="mt-1 text-[10px] text-muted">
                      {formatDate(event.start_time)} –{" "}
                      {formatDate(event.end_time)}
                    </p>
                  )}
                  {event.description && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-muted">
                      {event.description}
                    </p>
                  )}
                  <div className="mt-3 flex justify-end gap-1">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${event.title}`}
                      onClick={() => setEditor(event)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${event.title}`}
                      onClick={() => setDeleting(event)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CalendarDays size={23} />}
              title="Some space to yourself"
              description="Nothing planned for this day. Add an event when you’re ready."
            />
          )}
          <div className="border-t border-line p-4">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setEditor("new")}
            >
              <Plus size={14} />
              Add an event
            </Button>
          </div>
        </section>
      </div>
      {query.hasNextPage && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm">
          <p className="mb-3 text-muted">
            This calendar shows the first{" "}
            {query.data?.pages.flatMap((page) => page.items).length} of{" "}
            {query.data?.pages[0].total} events in this range.
          </p>
          <Button
            variant="secondary"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Load more events
          </Button>
        </div>
      )}
      <RecordEditor
        kind="events"
        open={editor !== null}
        item={editor && editor !== "new" ? editor : undefined}
        onClose={() => setEditor(null)}
        initialDate={selected}
      />
      <DeleteRecordDialog
        kind="events"
        item={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
