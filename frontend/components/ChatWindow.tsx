"use client";

import { useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CircleCheck,
  Copy,
  LoaderCircle,
  Mic,
  NotebookPen,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { api, errorMessage } from "@/lib/api";
import { browserTimezone, formatDate, formatTime } from "@/lib/dates";
import {
  useSession,
  useSystemStatus,
  useWorkspaceMutation,
} from "@/lib/queries";
import { useDictation } from "@/lib/useDictation";
import type { ChatRun, Kind, Page } from "@/lib/types";
import { ConfirmDialog } from "./ui/Modal";
import {
  Badge,
  Button,
  ErrorState,
  FormError,
  LoadingState,
  PageHeader,
} from "./ui/Primitives";
import WorkflowVisualizer from "./WorkflowVisualizer";

const suggestions = [
  {
    icon: CircleCheck,
    title: "Find my next steps",
    subtitle: "Turn a goal into a manageable plan",
    prompt: "Plan my week for a product launch",
    tone: "badge-blue",
  },
  {
    icon: NotebookPen,
    title: "Make sense of my notes",
    subtitle: "Capture what matters from a meeting",
    prompt:
      "Summarize this meeting: We agreed to finish the launch brief this week. Maya will review the designs, and I will collect two customer examples.",
    tone: "badge-amber",
  },
  {
    icon: CalendarDays,
    title: "Make a little time",
    subtitle: "Carve out space in my calendar",
    prompt: "Schedule a focus session tomorrow at 10am",
    tone: "badge-purple",
  },
  {
    icon: Bell,
    title: "Keep it on my radar",
    subtitle: "One less thing to remember",
    prompt: "Remind me to review the launch brief tomorrow at 9am",
    tone: "badge-teal",
  },
];
export default function ChatWindow() {
  const { data: session } = useSession();
  const { data: status } = useSystemStatus();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [model, setModel] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<{
    user_input: string;
    request_id: string;
    model_name?: string;
  } | null>(null);
  const speech = useDictation(setInput);
  const key = ["workspace", session?.user.id, "chat"];
  const history = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) =>
      api<Page<ChatRun>>(`/chat?limit=20&offset=${pageParam}`, { signal }),
    initialPageParam: 0,
    getNextPageParam: (page) =>
      page.offset + page.limit < page.total
        ? page.offset + page.limit
        : undefined,
    enabled: !!session,
  });
  const send = useMutation({
    mutationFn: (payload: {
      user_input: string;
      request_id: string;
      model_name?: string;
    }) => api<ChatRun>("/chat", { method: "POST", body: payload }),
    onSuccess: async () => {
      setInput("");
      requestRef.current = null;
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const runs = (
    history.data?.pages.flatMap((page) => page.items) || []
  ).toReversed();
  const latest = runs.at(-1);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "end",
    });
  }, [latest?.id, send.isPending]);
  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || send.isPending || status?.ai_mode === "disabled") return;
    speech.stop();
    const selectedModel =
      status?.ai_mode === "vertex" ? model || status.default_model : undefined;
    if (
      requestRef.current?.user_input !== text ||
      requestRef.current?.model_name !== selectedModel
    ) {
      requestRef.current = {
        user_input: text,
        model_name: selectedModel,
        request_id: crypto.randomUUID(),
      };
    }
    send.mutate(requestRef.current);
  }
  const clear = useWorkspaceMutation(
    () => api("/chat", { method: "DELETE" }),
    "Assistant history cleared",
  );
  return (
    <>
      <PageHeader
        eyebrow="A THINKING PARTNER FOR YOUR EVERYDAY"
        title="Let’s find a way forward."
        description="Bring a thought, a goal, or a busy mind. We’ll start with one next step."
        action={
          <Button
            variant="ghost"
            disabled={!runs.length || send.isPending}
            onClick={() => setClearOpen(true)}
          >
            <Trash2 size={14} />
            Clear history
          </Button>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_270px]">
        <div className="panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="agent-icon">
                <Sparkles size={17} />
              </span>
              <div>
                <h2 className="text-xs font-semibold">Your AI Ops assistant</h2>
                <p className="mt-0.5 text-[10px] text-muted">
                  Planning · Notes · Calendar · Reminders
                </p>
              </div>
            </div>
            {status?.ai_mode === "vertex" ? (
              <select
                aria-label="Assistant model"
                className="input !min-h-8 !w-auto !py-1 !text-[11px]"
                value={model || status.default_model}
                onChange={(event) => setModel(event.target.value)}
                disabled={send.isPending}
              >
                {status.models.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <Badge tone="amber">
                {status?.ai_mode === "disabled"
                  ? "Assistant disabled"
                  : "Demo templates"}
              </Badge>
            )}
          </div>
          {status?.ai_mode === "demo" && (
            <div className="border-b border-line bg-[#fffaf0] px-5 py-3 text-[11px] leading-5 text-[#856831] dark:bg-[#302d20] dark:text-[#dac79d]">
              You’re in demo mode. Replies are deterministic local examples, not
              AI-generated. No cloud calls are made.
            </div>
          )}
          <div
            className="max-h-[65dvh] min-h-[400px] overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
            role="log"
            aria-label="Assistant conversation"
            aria-live="polite"
          >
            {history.hasNextPage && (
              <div className="mb-5 text-center">
                <Button
                  variant="secondary"
                  loading={history.isFetchingNextPage}
                  onClick={() => void history.fetchNextPage()}
                >
                  Show earlier messages
                </Button>
              </div>
            )}
            {history.isPending ? (
              <LoadingState label="Opening your conversation…" />
            ) : history.isError ? (
              <ErrorState
                error={history.error}
                retry={() => void history.refetch()}
              />
            ) : !runs.length ? (
              <div className="mx-auto max-w-lg py-6">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/10 bg-accent-soft text-accent">
                  <Sparkles size={26} strokeWidth={1.5} />
                </div>
                <h3 className="text-center text-[23px] font-medium tracking-tight">
                  A busy mind, meet a clear plan.
                </h3>
                <p className="mx-auto mb-7 mt-3 max-w-sm text-center text-xs leading-6 text-muted">
                  What would make your day a little easier? Pick a starting
                  point, or tell me what’s on your mind.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {suggestions.map(
                    ({ icon: Icon, title, subtitle, prompt, tone }) => (
                      <button
                        key={title}
                        onClick={() => {
                          setInput(prompt);
                          inputRef.current?.focus();
                        }}
                        className="rounded-xl border border-line p-4 text-left transition-colors hover:border-accent/40 hover:bg-canvas"
                      >
                        <span
                          className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="mb-1.5 block text-xs font-semibold">
                          {title}
                        </span>
                        <span className="block text-[10px] leading-5 text-muted">
                          {subtitle}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </div>
            ) : (
              runs.map((run) => <Conversation key={run.id} run={run} />)
            )}
            {send.isPending && (
              <div className="my-5 flex items-center gap-3 rounded-xl bg-canvas p-4">
                <LoaderCircle
                  size={18}
                  className="shrink-0 animate-spin text-accent"
                />
                <div>
                  <p className="text-xs font-medium">Finding your next step…</p>
                  <p className="mt-1 text-[10px] text-muted">
                    Preparing a proposal. Nothing is saved yet.
                  </p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            onSubmit={submit}
            className="border-t border-line bg-surface p-4 sm:p-5"
          >
            <FormError
              message={send.isError ? errorMessage(send.error) : undefined}
            />
            <div
              className={clsx(
                "relative rounded-xl border border-line bg-canvas px-4 pb-3 pt-3 focus-within:border-accent/50",
                send.isError && "mt-3",
              )}
            >
              <label htmlFor="assistant-message" className="sr-only">
                Message your assistant
              </label>
              <textarea
                ref={inputRef}
                id="assistant-message"
                className="w-full resize-none border-0 bg-transparent text-[13px] leading-6 placeholder:text-muted focus:outline-none"
                placeholder={
                  status?.ai_mode === "disabled"
                    ? "The assistant is disabled. You can still create items manually."
                    : "What’s on your mind?"
                }
                rows={2}
                maxLength={8000}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={send.isPending || status?.ai_mode === "disabled"}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-muted">
                  {input.length > 7000
                    ? `${input.length.toLocaleString()} / 8,000`
                    : "Shift + Enter for a new line"}
                </span>
                <div className="flex gap-2">
                  {speech.isSupported && (
                    <button
                      type="button"
                      className={clsx(
                        "icon-button",
                        speech.listening && "!bg-red-100 !text-red-600",
                      )}
                      disabled={send.isPending}
                      onClick={speech.toggle}
                      aria-label={
                        speech.listening
                          ? "Stop dictation"
                          : "Start browser dictation"
                      }
                      title="Uses your browser’s speech service; audio may leave your device"
                    >
                      <Mic size={17} />
                    </button>
                  )}
                  <Button
                    type="submit"
                    className="!min-h-8 !rounded-lg !p-2"
                    disabled={
                      !input.trim() ||
                      send.isPending ||
                      status?.ai_mode === "disabled"
                    }
                    aria-label="Send message"
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </div>
            </div>
            <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-[9px] leading-4 text-muted">
              <ShieldCheck size={11} className="mt-0.5 shrink-0" />
              Review before saving. Each request is independent; include all
              needed context.
            </p>
          </form>
        </div>
        <WorkflowVisualizer run={latest} loading={send.isPending} />
      </div>
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear assistant history?"
        description="This removes your messages and pending proposals. Tasks, notes, events, and reminders you already saved will stay in your workspace."
        label="Clear history"
        onConfirm={() => clear.mutateAsync()}
      />
    </>
  );
}

function Conversation({ run }: { run: ChatRun }) {
  const actionCount =
    run.proposal.tasks.length +
    run.proposal.notes.length +
    run.proposal.events.length +
    run.proposal.reminders.length;
  const apply = useWorkspaceMutation(
    () => api<ChatRun>(`/chat/${run.id}/apply`, { method: "POST" }),
    "Your proposal is saved to the workspace",
  );
  const discard = useWorkspaceMutation(
    () => api<ChatRun>(`/chat/${run.id}/discard`, { method: "POST" }),
    "Proposal discarded. Nothing was saved.",
  );
  const collections = ["tasks", "notes", "events", "reminders"] as Kind[];
  return (
    <div className="mb-8 space-y-5">
      <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-accent-soft px-4 py-3.5">
        <p className="whitespace-pre-wrap break-words text-[13px] leading-6">
          {run.user_input}
        </p>
        <p className="mt-2 text-right text-[9px] text-muted">
          {formatTime(run.created_at)}
        </p>
      </div>
      <div className="flex gap-3">
        <span className="agent-icon mt-0.5">
          <Sparkles size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold">AI Ops</span>
            <Badge tone="gray">
              {run.intent === "general" ? "Assistant" : `${run.intent} agent`}
            </Badge>
          </div>
          <p className="whitespace-pre-wrap break-words text-[13px] leading-7">
            {run.proposal.message}
          </p>
          {actionCount > 0 && (
            <div
              className={clsx(
                "mt-4 overflow-hidden rounded-xl border border-line",
                run.status === "discarded" && "opacity-60",
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {run.status === "pending"
                    ? "Ready for your review"
                    : run.status === "applied"
                      ? "Saved to your workspace"
                      : "Proposal discarded"}
                </span>
                <Badge tone={run.status === "applied" ? "teal" : "gray"}>
                  {actionCount} {actionCount === 1 ? "item" : "items"}
                </Badge>
              </div>
              <p className="border-b border-line px-4 py-2 text-[10px] text-muted">
                Dates and times shown in {browserTimezone()}.
              </p>
              <div className="divide-y divide-line">
                {run.proposal.tasks.map((task, i) => (
                  <div key={`task-${i}`} className="flex gap-3 p-4">
                    <CircleCheck
                      size={16}
                      className="mt-0.5 shrink-0 text-accent"
                    />
                    <div className="min-w-0">
                      <p className="break-words text-xs font-medium">
                        {task.title}
                      </p>
                      <p className="mt-1.5 text-[10px] text-muted">
                        Task · {task.priority} priority ·{" "}
                        {formatDate(task.due_at, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {run.proposal.notes.map((note, i) => (
                  <div key={`note-${i}`} className="flex gap-3 p-4">
                    <NotebookPen
                      size={16}
                      className="mt-0.5 shrink-0 text-accent"
                    />
                    <div className="min-w-0">
                      <p className="break-words text-xs font-medium">
                        {note.title}
                      </p>
                      {note.summary && (
                        <p className="mt-2 break-words text-xs leading-6 text-muted">
                          {note.summary}
                        </p>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[10px] font-medium text-accent">
                          Review note content
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-muted">
                          {note.content}
                        </p>
                        {note.action_items.length > 0 && (
                          <ul className="mt-2 list-inside list-disc text-xs leading-6">
                            {note.action_items.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </details>
                    </div>
                  </div>
                ))}
                {run.proposal.events.map((event, i) => (
                  <div key={`event-${i}`} className="flex gap-3 p-4">
                    <CalendarDays
                      size={16}
                      className="mt-0.5 shrink-0 text-accent"
                    />
                    <div className="min-w-0">
                      <p className="break-words text-xs font-medium">
                        {event.title}
                      </p>
                      <p className="mt-1.5 text-[10px] leading-5 text-muted">
                        {formatDate(event.start_time, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        <br />
                        to{" "}
                        {formatDate(event.end_time, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {event.description && (
                        <p className="mt-1 text-xs text-muted">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {run.proposal.reminders.map((reminder, i) => (
                  <div key={`reminder-${i}`} className="flex gap-3 p-4">
                    <Bell size={16} className="mt-0.5 shrink-0 text-accent" />
                    <div className="min-w-0">
                      <p className="break-words text-xs font-medium">
                        {reminder.title}
                      </p>
                      <p className="mt-1.5 text-[10px] text-muted">
                        Reminder · {reminder.urgency} urgency ·{" "}
                        {formatDate(reminder.due_at, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {reminder.suggestion && (
                        <p className="mt-1 text-xs text-muted">
                          {reminder.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {run.status === "pending" ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas px-4 py-3">
                  <Button
                    className="!min-h-8 !py-2 !text-xs"
                    loading={apply.isPending}
                    disabled={discard.isPending}
                    onClick={() => apply.mutate()}
                  >
                    <Check size={13} />
                    Confirm & save
                  </Button>
                  <Button
                    variant="ghost"
                    className="!min-h-8 !py-2 !text-xs"
                    loading={discard.isPending}
                    disabled={apply.isPending}
                    onClick={() => discard.mutate()}
                  >
                    Discard
                  </Button>
                </div>
              ) : run.status === "applied" ? (
                <div className="flex flex-wrap gap-4 border-t border-line px-4 py-3">
                  {collections
                    .filter((name) => run.proposal[name].length > 0)
                    .map((name) => (
                      <Link
                        className="text-link"
                        href={name === "events" ? "/calendar" : `/${name}`}
                        key={name}
                      >
                        View {name}
                        <ArrowRight size={11} />
                      </Link>
                    ))}
                </div>
              ) : null}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[9px] text-muted">
              {run.mode === "demo" ? "Demo template" : run.model}
            </span>
            <button
              className="icon-button !h-6 !w-6"
              aria-label="Copy assistant reply"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(run.proposal.message);
                  toast.success("Reply copied");
                } catch {
                  toast.error("Clipboard access is unavailable.");
                }
              }}
            >
              <Copy size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
