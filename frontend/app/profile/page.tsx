"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Download,
  Info,
  LockKeyhole,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { avatars } from "@/lib/avatars";
import { api, errorMessage, setCsrfToken } from "@/lib/api";
import { useSession, useSystemStatus } from "@/lib/queries";
import type { Session, User } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/Modal";
import {
  Badge,
  Button,
  FormError,
  LoadingState,
  PageHeader,
} from "@/components/ui/Primitives";

export default function ProfilePage() {
  const { data: session } = useSession();
  const { data: status } = useSystemStatus();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const queryClient = useQueryClient();
  const router = useRouter();
  if (!session) return <LoadingState />;
  async function downloadExport() {
    setExporting(true);
    try {
      const blob = await api<Blob>("/users/me/export", { raw: true });
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ai-ops-export.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Your data export is ready");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }
  async function deleteAccount() {
    if (confirmation !== "DELETE")
      throw new Error("Type DELETE to confirm this permanent action.");
    await api("/users/me", {
      method: "DELETE",
      body: { current_password: deletePassword },
    });
    await queryClient.cancelQueries();
    queryClient.clear();
    setCsrfToken(null);
    queryClient.setQueryData(["session"], null);
    router.replace("/login");
  }
  return (
    <>
      <PageHeader
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your workspace, your way"
        description="A few preferences, a little security, and full control of your data."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <ProfileForm
          key={`${session.user.id}-${session.user.username}-${session.user.timezone}-${session.user.avatar}`}
          user={session.user}
        />
        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={17} className="text-accent" />A transparent
              workspace
            </h2>
            <dl className="space-y-4 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Assistant</dt>
                <dd>
                  <Badge tone={status?.ai_mode === "vertex" ? "teal" : "amber"}>
                    {status?.ai_mode === "demo"
                      ? "Local demo templates"
                      : status?.ai_mode === "vertex"
                        ? "Vertex AI"
                        : status?.ai_mode === "disabled"
                          ? "Disabled"
                          : "Checking…"}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Storage</dt>
                <dd className="font-medium">
                  {status?.storage === "postgresql"
                    ? "PostgreSQL"
                    : status?.storage === "sqlite"
                      ? "Local SQLite"
                      : "Checking…"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Reminder delivery</dt>
                <dd className="font-medium">In-app only</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">External calendar sync</dt>
                <dd className="font-medium">Not connected</dd>
              </div>
            </dl>
            <p className="mt-5 border-t border-line pt-4 text-xs leading-6 text-muted">
              {status?.ai_mode === "vertex"
                ? "Assistant messages are sent to your configured Google Cloud Vertex AI service. Only proposals you confirm become workspace items."
                : "In demo mode, your messages use deterministic templates. They are not sent to Google Cloud."}
            </p>
          </section>
          <section className="panel p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Database size={17} className="text-accent" />
              Your data belongs with you
            </h2>
            <p className="mb-5 text-xs leading-6 text-muted">
              Download your profile, tasks, notes, events, reminders, and
              assistant history as JSON. Passwords and sessions are never
              included.
            </p>
            <Button
              variant="secondary"
              className="w-full"
              loading={exporting}
              onClick={downloadExport}
            >
              <Download size={14} />
              Export my data
            </Button>
            <p className="field-hint">
              Up to 10,000 items per collection and 8 MiB overall. Check the
              export’s truncation metadata before treating it as a complete
              copy.
            </p>
          </section>
          <section className="rounded-2xl border border-red-200/70 bg-surface p-6 dark:border-red-900/50">
            <h2 className="text-sm font-semibold">Delete your workspace</h2>
            <p className="mb-4 mt-2 text-xs leading-6 text-muted">
              Permanently remove your account and all its data. This action
              cannot be undone.
            </p>
            <Button
              variant="ghost"
              className="!px-0 !text-red-600 dark:!text-red-300"
              onClick={() => {
                setConfirmation("");
                setDeletePassword("");
                setDeleting(true);
              }}
            >
              Delete account
            </Button>
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Permanently delete your account?"
        description="All tasks, notes, calendar events, reminders, saved proposals, and active sessions will be removed. Export anything you want to keep first."
        label="Delete everything"
        onConfirm={deleteAccount}
      >
        {!session.user.is_demo && (
          <div>
            <label htmlFor="delete-password" className="label">
              Current password
            </label>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              className="input"
              maxLength={128}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="delete-confirmation">
            Type DELETE to confirm
          </label>
          <input
            className="input"
            id="delete-confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
function ProfileForm({ user }: { user: User }) {
  const [username, setUsername] = useState(user.username);
  const [timezone, setTimezone] = useState(user.timezone);
  const [avatar, setAvatar] = useState(user.avatar);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (newPassword && newPassword !== confirmPassword) {
      setError("The new passwords don’t match.");
      return;
    }
    setBusy(true);
    try {
      const session = await api<Session>("/users/me", {
        method: "PATCH",
        body: {
          username,
          timezone,
          avatar,
          current_password: currentPassword,
          new_password: newPassword || null,
        },
      });
      setCsrfToken(session.csrf_token);
      queryClient.setQueryData(["session"], session);
      toast.success(
        newPassword
          ? "Password changed. Other sessions have been signed out."
          : "Your preferences are saved",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel p-6 sm:p-7" onSubmit={save}>
      <h2 className="mb-6 flex items-center gap-2 text-sm font-semibold">
        <UserRound size={17} className="text-accent" />A little about you
      </h2>
      <div className="space-y-5">
        <div>
          <label htmlFor="profile-name" className="label">
            Your name
          </label>
          <input
            id="profile-name"
            className="input"
            autoComplete="nickname"
            required
            minLength={2}
            maxLength={60}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="profile-email" className="label">
            Email address
          </label>
          <input
            id="profile-email"
            className="input !bg-canvas text-muted"
            value={user.is_demo ? "Private demo account" : user.email}
            readOnly
          />
          <p className="field-hint">
            Your sign-in email cannot be changed here.
          </p>
        </div>
        <div>
          <label htmlFor="profile-timezone" className="label">
            Assistant timezone
          </label>
          <input
            id="profile-timezone"
            className="input"
            required
            maxLength={64}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. Europe/London"
            list="common-timezones"
          />
          <datalist id="common-timezones">
            {[
              "UTC",
              "America/New_York",
              "America/Los_Angeles",
              "Europe/London",
              "Europe/Paris",
              "Asia/Kolkata",
              "Asia/Tokyo",
              "Australia/Sydney",
            ].map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <p className="field-hint">
            Use an IANA timezone. The assistant uses this to understand dates;
            calendar inputs and displays use your browser’s local timezone.
          </p>
        </div>
        <div>
          <label htmlFor="profile-avatar" className="label">
            Avatar
          </label>
          <select
            className="input"
            id="profile-avatar"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
          >
            {avatars.map((avatar) => (
              <option value={avatar.value} key={avatar.value}>
                {avatar.symbol} {avatar.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-6 mt-8 border-t border-line pt-6">
        <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold">
          <LockKeyhole size={17} className="text-accent" />
          Keep it secure
        </h2>
        {user.is_demo ? (
          <p className="flex items-start gap-2 text-xs leading-6 text-muted">
            <Info size={16} className="mt-1 shrink-0" />
            This is a demo account. Sign out and create a personal account to
            set your own password.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs leading-6 text-muted">
              Leave these fields blank to keep your current password. Changing
              it signs out all other sessions.
            </p>
            <div>
              <label htmlFor="current-password" className="label">
                Current password
              </label>
              <input
                id="current-password"
                className="input"
                type="password"
                autoComplete="current-password"
                required={!!newPassword}
                maxLength={128}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new-password" className="label">
                New password
              </label>
              <input
                id="new-password"
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="field-hint">
                12–128 characters. Use a unique passphrase.
              </p>
            </div>
            <div>
              <label htmlFor="confirm-password" className="label">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                className="input"
                type="password"
                autoComplete="new-password"
                required={!!newPassword}
                maxLength={128}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
      <FormError message={error} />
      <Button type="submit" className="mt-5" loading={busy}>
        <Save size={14} />
        Save preferences
      </Button>
    </form>
  );
}
