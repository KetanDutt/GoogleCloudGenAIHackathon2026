"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Bell,
  CalendarDays,
  CircleCheck,
  LayoutGrid,
  LogOut,
  NotebookPen,
  Settings2,
  Sparkles,
  Layers3,
  ArrowUpRight,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { avatars } from "@/lib/avatars";
import { api, errorMessage, setCsrfToken } from "@/lib/api";
import { useSession, useSystemStatus } from "@/lib/queries";

export const navItems = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/chat", label: "AI assistant", icon: Sparkles },
  { href: "/tasks", label: "Tasks", icon: CircleCheck },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reminders", label: "Reminders", icon: Bell },
];
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={clsx("flex items-center gap-3", light && "text-white")}
      aria-label="AI Ops home"
    >
      <span className="brand-mark">
        <Layers3 size={22} strokeWidth={1.8} />
      </span>
      <span>
        <span className="block text-[19px] font-bold tracking-tight">
          AI Ops<span className="ml-1 text-accent">.</span>
        </span>
        <span
          className={clsx(
            "block text-[10px] font-medium tracking-[.1em]",
            light ? "text-white/65" : "text-muted",
          )}
        >
          PERSONAL WORKSPACE
        </span>
      </span>
    </Link>
  );
}
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: status } = useSystemStatus();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST" });
      await queryClient.cancelQueries();
      queryClient.clear();
      setCsrfToken(null);
      queryClient.setQueryData(["session"], null);
      onNavigate?.();
      router.replace("/login");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex h-full flex-col bg-surface px-5 py-7">
      <div className="px-2">
        <Brand />
      </div>
      <p className="mb-3 mt-11 px-3 text-[10px] font-semibold tracking-[.16em] text-muted">
        WORKSPACE
      </p>
      <nav aria-label="Main navigation" className="space-y-1.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={pathname === href ? "page" : undefined}
            className={clsx("nav-item", pathname === href && "active")}
          >
            <Icon size={19} strokeWidth={1.7} />
            <span>{label}</span>
            {href === "/chat" && (
              <span
                aria-hidden="true"
                className="ml-auto rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent"
              >
                AI
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-8">
        <div className="sidebar-tip">
          <div className="mb-2 flex items-center gap-2 text-accent">
            <Sparkles size={16} />
            <span className="text-xs font-semibold">
              A little help, a lot of clarity
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Turn that idea into a next step. Your assistant is ready when you
            are.
          </p>
          <Link
            href="/chat"
            onClick={onNavigate}
            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-accent"
          >
            Let’s make a plan <ArrowUpRight size={14} />
          </Link>
        </div>
        <Link
          href="/profile"
          onClick={onNavigate}
          className={clsx("nav-item mt-4", pathname === "/profile" && "active")}
          aria-current={pathname === "/profile" ? "page" : undefined}
        >
          <Settings2 size={19} strokeWidth={1.7} />
          Settings
        </Link>
        <div className="mt-5 flex items-center gap-3 border-t border-line px-1 pt-5">
          <Link
            href="/profile"
            onClick={onNavigate}
            aria-label="Your profile"
            className="avatar"
          >
            {avatars.find((avatar) => avatar.value === session?.user.avatar)
              ?.symbol || session?.user.username.slice(0, 2).toUpperCase()}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {session?.user.username}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {session?.user.is_demo
                ? "Demo workspace"
                : status?.ai_mode === "vertex"
                  ? "Personal workspace"
                  : "Local workspace"}
            </p>
          </div>
          <button
            aria-label="Sign out"
            title="Sign out"
            disabled={busy}
            onClick={logout}
            className="icon-button"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
