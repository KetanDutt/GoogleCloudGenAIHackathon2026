export type Priority = "low" | "medium" | "high";
export type Status = "pending" | "completed";
export type Kind = "tasks" | "notes" | "events" | "reminders";
export interface User {
  id: string;
  email: string;
  username: string;
  avatar: string;
  timezone: string;
  is_demo: boolean;
  created_at: string;
}
export interface Session {
  user: User;
  csrf_token: string;
}
export interface RecordBase {
  id: string;
  created_at: string;
  updated_at: string;
  version: number;
}
export interface TaskInput {
  title: string;
  due_at: string | null;
  priority: Priority;
}
export interface Task extends RecordBase, TaskInput {
  status: Status;
}
export interface NoteInput {
  title: string;
  content: string;
}
export interface Note extends RecordBase, NoteInput {
  summary: string | null;
  action_items: string[];
}
export interface EventInput {
  title: string;
  start_time: string;
  end_time: string;
  description: string;
}
export interface CalendarEvent extends RecordBase, EventInput {}
export interface ReminderInput {
  title: string;
  due_at: string | null;
  urgency: Priority;
  suggestion: string;
}
export interface Reminder extends RecordBase, ReminderInput {
  status: Status;
}
export type WorkspaceItem = Task | Note | CalendarEvent | Reminder;
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface Trace {
  step: string;
  details: string;
}
export interface Proposal {
  message: string;
  tasks: TaskInput[];
  notes: (NoteInput & { summary: string | null; action_items: string[] })[];
  events: EventInput[];
  reminders: ReminderInput[];
}
export interface ChatRun extends RecordBase {
  user_input: string;
  request_id: string;
  intent: "planner" | "notes" | "calendar" | "reminder" | "general";
  mode: "demo" | "vertex";
  model: string | null;
  status: "pending" | "applied" | "discarded" | "info";
  proposal: Proposal;
  trace: Trace[];
  applied_ids: Record<Kind, string[]>;
}
export interface SystemStatus {
  version: string;
  ai_mode: "demo" | "vertex" | "disabled";
  ai_status: string;
  demo_login: boolean;
  models: string[];
  default_model: string;
  storage: "sqlite" | "postgresql";
  reminder_delivery: "in_app_only";
}
export interface Dashboard {
  counts: {
    tasks: number;
    completed: number;
    pending: number;
    overdue: number;
    notes: number;
    reminders: number;
  };
  focus_tasks: Task[];
  upcoming_events: CalendarEvent[];
  recent_notes: Note[];
}
