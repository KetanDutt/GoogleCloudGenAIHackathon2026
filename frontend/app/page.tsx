"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  NotebookPen,
  Plus,
  Sparkles,
} from "lucide-react";
import { useSession, useWorkspace } from "@/lib/queries";
import { formatDate, formatTime } from "@/lib/dates";
import type { Dashboard } from "@/lib/types";
import RecordEditor from "@/components/RecordEditor";
import TaskRow from "@/components/TaskRow";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from "@/components/ui/Primitives";

export default function Home() {
  const { data: session } = useSession();
  const query = useWorkspace<Dashboard>("dashboard");
  const [newTask, setNewTask] = useState(false);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const unavailable = query.isError && !query.data;
  const counts = query.data?.counts;
  const stats = [
    {
      title: "Tasks to do",
      value: counts?.pending,
      icon: CircleCheck,
      tone: "badge-blue",
      href: "/tasks",
      detail: counts?.overdue
        ? `${counts.overdue} ${counts.overdue === 1 ? "needs" : "need"} a little attention`
        : "One next step at a time",
    },
    {
      title: "Notes captured",
      value: counts?.notes,
      icon: NotebookPen,
      tone: "badge-amber",
      href: "/notes",
      detail: "Good ideas, safely kept",
    },
    {
      title: "Tasks completed",
      value: counts?.completed,
      icon: Check,
      tone: "badge-teal",
      href: "/tasks",
      detail: counts?.tasks
        ? `${Math.round((counts.completed / counts.tasks) * 100)}% of your tasks, done`
        : "Small wins add up",
    },
    {
      title: "Active reminders",
      value: counts?.reminders,
      icon: Bell,
      tone: "badge-purple",
      href: "/reminders",
      detail: "A little less to remember",
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow={formatDate(new Date().toISOString(), {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        title={`${greeting}, ${session?.user.username.split(" ")[0] || "there"}.`}
        description="Let’s make a little room for what matters today."
        action={
          <Button onClick={() => setNewTask(true)}>
            <Plus size={16} />
            New task
          </Button>
        }
      />
      <section className="hero mb-6" aria-label="Your personal assistant">
        <div className="hero-orbit -right-12 -top-28 h-[450px] w-[450px]" />
        <div className="hero-orbit -right-1 -top-16 h-[350px] w-[350px]" />
        <div className="hero-orbit right-12 -top-3 h-[250px] w-[250px]" />
        <div className="relative z-10 flex items-center justify-between gap-8">
          <div className="max-w-lg">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-medium tracking-[.13em] text-[#a8d6c9]">
              <Sparkles size={13} /> YOUR PERSONAL OPERATIONS MANAGER
            </div>
            <h2 className="text-[25px] font-medium leading-tight tracking-[-.035em] sm:text-[30px]">
              Less mental clutter.
              <br />
              More meaningful progress.
            </h2>
            <p className="mt-3 max-w-sm text-xs leading-6 text-[#bad2cc]">
              From a passing thought to a clear plan. Bring your ideas — we’ll
              help you find the next step.
            </p>
            <Link
              href="/chat"
              className="mt-5 inline-flex items-center gap-3 rounded-lg bg-[#d2efde] px-4 py-2.5 text-xs font-semibold text-[#173e3d] transition-colors hover:bg-white"
            >
              <Sparkles size={14} />
              Let’s make a plan
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="relative mr-9 hidden w-60 rotate-[-5deg] rounded-xl border border-white/20 bg-white/[.07] px-5 py-5 backdrop-blur-sm xl:block">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d2efde] text-[#173e3d]">
                <LayersIcon />
              </div>
              <span className="text-[9px] font-medium tracking-[.1em] text-[#bad2cc]">
                A CLEARER WAY FORWARD
              </span>
            </div>
            {[
              "Capture the thought",
              "Find the next step",
              "Make it happen",
            ].map((text, index) => (
              <div key={text} className="mt-3 flex items-center gap-2.5">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full ${index < 2 ? "bg-[#c8e7db] text-[#173e3d]" : "border border-white/35"}`}
                >
                  {index < 2 && <Check size={10} />}
                </span>
                <span className="text-[11px] text-[#ecf4f0]">{text}</span>
              </div>
            ))}
            <div className="absolute -bottom-4 -right-8 rotate-[8deg] rounded-lg border border-[#d8e9e1] bg-[#f2faf5] px-3 py-2 text-[10px] font-medium text-[#265445]">
              <Sparkles size={12} className="mr-1.5 inline" />A little help goes
              a long way.
            </div>
          </div>
        </div>
      </section>
      {query.isError && (
        <div className="mb-6">
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link href={stat.href} className="stat-card" key={stat.title}>
            <div>
              <p className="mb-3 text-xs font-medium text-muted">
                {stat.title}
              </p>
              {unavailable ? (
                <p className="text-3xl text-muted" aria-label="Unavailable">
                  —
                </p>
              ) : stat.value === undefined ? (
                <Skeleton className="mb-2 h-8 w-12" />
              ) : (
                <p className="text-[29px] font-semibold leading-none tracking-tight">
                  {stat.value}
                </p>
              )}
              <p className="mt-3 text-[10px] text-muted">{stat.detail}</p>
            </div>
            <span className={`stat-icon ${stat.tone}`}>
              <stat.icon size={19} strokeWidth={1.7} />
            </span>
          </Link>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <section className="panel overflow-hidden">
            <div className="panel-heading">
              <div className="flex items-center gap-2.5">
                <CircleCheck size={17} className="text-accent" />
                <h2 className="panel-title">Your next priorities</h2>
              </div>
              <Link href="/tasks" className="text-link">
                View all
                <ArrowUpRight size={13} />
              </Link>
            </div>
            {query.isPending ? (
              <div className="space-y-4 p-5">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : unavailable ? (
              <p className="p-6 text-sm text-muted">
                Your priorities could not be loaded.
              </p>
            ) : query.data?.focus_tasks.length ? (
              query.data.focus_tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))
            ) : (
              <EmptyState
                icon={<CircleCheck size={24} />}
                title="A little breathing room"
                description="No pending tasks. Add a new goal when you’re ready."
                action={
                  <Button variant="secondary" onClick={() => setNewTask(true)}>
                    <Plus size={14} />
                    Add a task
                  </Button>
                }
              />
            )}
            <button
              onClick={() => setNewTask(true)}
              className="flex w-full items-center gap-2 border-t border-line px-5 py-3.5 text-xs font-medium text-muted hover:bg-canvas hover:text-accent"
            >
              <Plus size={15} />
              Add a new task
            </button>
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="panel-title">From your notebook</h2>
              <Link href="/notes" className="text-link">
                All notes
                <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {query.isPending ? (
                <Skeleton className="h-36" />
              ) : unavailable ? (
                <p className="panel p-6 text-sm text-muted">
                  Your notes could not be loaded.
                </p>
              ) : query.data?.recent_notes.length ? (
                query.data.recent_notes.map((note, index) => (
                  <Link
                    key={note.id}
                    href={`/notes?q=${encodeURIComponent(note.title)}`}
                    className="note-card"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${index ? "badge-purple" : "badge-amber"}`}
                      >
                        <NotebookPen size={16} />
                      </span>
                      <span className="text-[10px] text-muted">
                        {formatDate(note.updated_at)}
                      </span>
                    </div>
                    <h3 className="mb-2 line-clamp-1 text-[13px] font-semibold">
                      {note.title}
                    </h3>
                    <p className="line-clamp-2 text-xs leading-6 text-muted">
                      {note.summary || note.content}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="panel col-span-full p-6 text-center">
                  <NotebookPen size={21} className="mx-auto mb-2 text-muted" />
                  <p className="text-sm text-muted">
                    Good ideas deserve a home.
                  </p>
                  <Link href="/notes" className="text-link mt-3">
                    Write your first note
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="panel">
            <div className="panel-heading">
              <div className="flex items-center gap-2.5">
                <CalendarDays size={17} className="text-accent" />
                <h2 className="panel-title">On your calendar</h2>
              </div>
              <Link
                href="/calendar"
                className="icon-button !h-7 !w-7"
                aria-label="Open calendar"
              >
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="px-5 py-6">
              {query.isPending ? (
                <Skeleton className="h-48" />
              ) : unavailable ? (
                <p className="text-sm text-muted">
                  Your calendar could not be loaded.
                </p>
              ) : query.data?.upcoming_events.length ? (
                <div className="space-y-5">
                  {query.data.upcoming_events.map((event, index) => (
                    <div key={event.id} className="agenda-line">
                      <span
                        className={`agenda-dot ${index % 2 ? "!bg-[#9a8abc]" : ""}`}
                      />
                      <p className="mb-2 text-[10px] text-muted">
                        {formatDate(event.start_time, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        <span className="mx-1">·</span>{" "}
                        {formatTime(event.start_time)}
                      </p>
                      <div
                        className={`rounded-xl border-l-2 p-3.5 ${index % 2 ? "border-l-[#c4b6e0] bg-[#f5f2fa] dark:bg-[#2b2840]" : "border-l-[#8bc5b1] bg-[#eff7f3] dark:bg-[#203833]"}`}
                      >
                        <h3 className="break-words text-xs font-semibold">
                          {event.title}
                        </h3>
                        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
                          <Clock3 size={11} />
                          {formatTime(event.start_time)} –{" "}
                          {formatTime(event.end_time)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<CalendarDays size={23} />}
                  title="Your calendar has room"
                  description="Make space for focused work or something to look forward to."
                />
              )}
              <Link
                href="/calendar"
                className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-line py-2.5 text-xs font-medium text-muted hover:bg-soft"
              >
                Open calendar
                <ArrowRight size={13} />
              </Link>
            </div>
          </section>
          <div className="rounded-2xl border border-dashed border-line px-5 py-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="agent-icon">
                <Sparkles size={16} />
              </span>
              <h2 className="text-xs font-semibold">Thoughtful by design</h2>
            </div>
            <p className="text-xs leading-6 text-muted">
              Your assistant suggests. You decide. Every AI proposal waits for
              your review before it changes your workspace.
            </p>
            <Badge tone="teal" className="mt-3">
              You’re always in control
            </Badge>
          </div>
        </div>
      </div>
      <RecordEditor
        kind="tasks"
        open={newTask}
        onClose={() => setNewTask(false)}
      />
    </>
  );
}
function LayersIcon() {
  return <Sparkles size={19} />;
}
