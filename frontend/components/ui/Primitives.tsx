"use client";

import clsx from "clsx";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Search,
  Sparkles,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { errorMessage } from "@/lib/api";

export function Button({
  children,
  variant = "primary",
  loading,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx("btn", `btn-${variant}`, className)}
    >
      {loading && (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "gray",
  className,
}: {
  children: ReactNode;
  tone?: "teal" | "amber" | "purple" | "red" | "gray" | "blue";
  className?: string;
}) {
  return (
    <span className={clsx("badge", `badge-${tone}`, className)}>
      {children}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon || <Sparkles size={25} />}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      <AlertCircle size={19} className="shrink-0" />
      <p className="min-w-0 flex-1">{errorMessage(error)}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function FormError({ message }: { message?: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200"
    >
      {message}
    </p>
  ) : null;
}
export function LoadingState({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted"
    >
      <LoaderCircle size={20} className="animate-spin" />
      {label}
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx("animate-pulse rounded-lg bg-soft", className)}
    />
  );
}
export function SearchInput({
  value,
  onChange,
  label = "Search",
  placeholder = "Search…",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search
        size={17}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        aria-label={label}
        className="input pl-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={200}
      />
    </div>
  );
}
export function Pagination({
  total,
  page,
  limit,
  onChange,
}: {
  total: number;
  page: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  if (!total) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
      <p className="text-xs text-muted">
        {Math.min(page * limit + 1, total)}–
        {Math.min((page + 1) * limit, total)} of {total} items
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className="!p-2"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={16} />
        </Button>
        <Button
          variant="secondary"
          className="!p-2"
          aria-label="Next page"
          disabled={(page + 1) * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
