"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  NotebookPen,
  Play,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { api, errorMessage, setCsrfToken } from "@/lib/api";
import { browserTimezone } from "@/lib/dates";
import { useSystemStatus } from "@/lib/queries";
import type { Session } from "@/lib/types";
import { Brand } from "./Sidebar";
import { Button, FormError } from "./ui/Primitives";

export default function AuthPage({ register = false }: { register?: boolean }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"account" | "demo" | null>(null);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: status } = useSystemStatus();
  async function signIn(demo = false) {
    if (busy) return;
    setBusy(demo ? "demo" : "account");
    setError("");
    try {
      const session = await api<Session>(
        demo ? "/auth/demo" : register ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: demo
            ? undefined
            : {
                email: email.trim(),
                password,
                ...(register
                  ? { username: username.trim(), timezone: browserTimezone() }
                  : {}),
              },
        },
      );
      try {
        await api<Session>("/auth/session");
      } catch {
        throw new Error(
          "The session could not be verified. If this is an embedded preview, open it in a new tab or allow site cookies, then sign in again.",
        );
      }
      await queryClient.cancelQueries();
      queryClient.clear();
      setCsrfToken(session.csrf_token);
      queryClient.setQueryData(["session"], session);
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story" aria-label="About AI Ops">
        <div className="relative z-10">
          <Brand light />
        </div>
        <div className="hero-orbit -bottom-40 -right-52 h-[750px] w-[750px]" />
        <div className="hero-orbit -bottom-24 -right-36 h-[590px] w-[590px]" />
        <div className="hero-orbit -bottom-8 -right-20 h-[430px] w-[430px]" />
        <div className="relative z-10 my-12 max-w-md">
          <p className="mb-5 flex items-center gap-2 text-[10px] font-medium tracking-[.17em] text-[#b2dacc]">
            <Sparkles size={14} /> A LITTLE CLARITY GOES A LONG WAY
          </p>
          <h1 className="text-[44px] font-medium leading-[1.14] tracking-[-.04em] xl:text-[53px]">
            Your day.
            <br />A little more
            <br />
            <span className="text-[#add9c3]">together.</span>
          </h1>
          <p className="mt-6 max-w-xs text-sm leading-7 text-[#b9d3ca]">
            One thoughtful space for your tasks, notes, calendar, and the ideas
            that move you forward.
          </p>
          <div className="mt-10 max-w-sm rounded-2xl border border-white/15 bg-white/[.06] p-5 backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-xs font-medium">A clearer way to work</span>
              <span className="rounded bg-white/10 px-2 py-1 text-[9px] text-[#c7e7d5]">
                YOUR WORKSPACE
              </span>
            </div>
            {[
              {
                icon: CircleCheck,
                title: "Turn plans into progress",
                color: "#b1d5f6",
              },
              {
                icon: NotebookPen,
                title: "Keep your best ideas close",
                color: "#ecd7ad",
              },
              {
                icon: CalendarDays,
                title: "Make time for what matters",
                color: "#c8b9e8",
              },
            ].map(({ icon: Icon, title, color }) => (
              <div
                key={title}
                className="mb-4 flex items-center gap-3 last:mb-0"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"
                  style={{ color }}
                >
                  <Icon size={15} />
                </span>
                <span className="text-xs text-[#e4eee8]">{title}</span>
                <Check size={12} className="ml-auto text-[#a6cdb8]" />
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-[10px] text-[#b9d3ca]">
          <LockKeyhole size={13} />
          Your assistant suggests. You’re always in control.
        </div>
      </section>
      <section className="auth-form-area">
        <div className="w-full max-w-[360px]">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          <p className="eyebrow mb-3">YOUR PERSONAL WORKSPACE</p>
          <h2 className="text-[29px] font-semibold tracking-[-.035em]">
            {register ? "Make a little space for you." : "Welcome back."}
          </h2>
          <p className="mb-8 mt-3 text-sm leading-6 text-muted">
            {register
              ? "A calmer, clearer day starts with one small step."
              : "Your ideas, plans, and next steps are right here."}
          </p>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn();
            }}
          >
            {register && (
              <div>
                <label htmlFor="username" className="label">
                  Your name
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="input"
                  autoComplete="nickname"
                  required
                  minLength={2}
                  maxLength={60}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="What should we call you?"
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="input"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="input pr-11"
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    register
                      ? "Choose a strong passphrase"
                      : "Enter your password"
                  }
                  aria-describedby={register ? "password-hint" : undefined}
                />
                <button
                  type="button"
                  className="icon-button absolute right-1 top-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {register && (
                <p id="password-hint" className="field-hint">
                  12–128 characters. A memorable, unique passphrase works well.
                </p>
              )}
            </div>
            <FormError message={error} />
            <Button
              className="!mt-6 w-full"
              type="submit"
              loading={busy === "account"}
              disabled={!!busy}
            >
              {register ? "Create your workspace" : "Sign in"}
              <ArrowRight size={15} />
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted">
            {register
              ? "Already have a little space here?"
              : "New around here?"}{" "}
            <Link
              href={register ? "/login" : "/register"}
              className="font-semibold text-accent hover:underline"
            >
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          {status?.demo_login && (
            <div className="mt-8 border-t border-line pt-7">
              <Button
                variant="secondary"
                className="w-full"
                loading={busy === "demo"}
                disabled={!!busy}
                onClick={() => void signIn(true)}
              >
                <Play size={13} />
                Explore a demo workspace
              </Button>
              <p className="mt-3 text-center text-[10px] leading-5 text-muted">
                No signup needed. Sample data, your own private demo.
                <br />
                {status.ai_mode === "demo"
                  ? "AI responses use local templates — no cloud calls."
                  : "Assistant proposals use the configured Vertex AI model."}
              </p>
            </div>
          )}
          <p className="mt-9 flex items-center justify-center gap-1.5 text-[10px] text-muted">
            <LockKeyhole size={11} />
            Secure sessions. No passwords stored in your browser.
          </p>
        </div>
      </section>
    </div>
  );
}
