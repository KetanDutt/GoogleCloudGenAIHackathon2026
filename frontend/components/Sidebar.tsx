"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, CheckSquare, StickyNote, LayoutDashboard, LogOut } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/useAppStore";

const publicRoutes = ["/login", "/register", "/forgot-password"];

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/notes", label: "Notes", icon: StickyNote },
];

const AVATARS: Record<string, string> = {
  "1": "👤",
  "2": "👩‍💻",
  "3": "👨‍💻",
  "4": "🤖",
  "5": "🦊",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, logout } = useAppStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (publicRoutes.includes(pathname)) {
    return null;
  }

  return (
    <aside className="w-64 border-r border-gray-200 bg-white h-screen flex flex-col pt-8 dark:bg-zinc-900 dark:border-zinc-800" suppressHydrationWarning>
      <div className="px-6 pb-6">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          AI Ops Manager
        </h1>
        <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
          Multi-Agent System
        </p>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-gray-200 dark:border-zinc-800 flex flex-col gap-2">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-lg">
              {AVATARS[user.avatar] || "👤"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium dark:text-white truncate">{user.username}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        {token && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        )}
      </div>
    </aside>
  );
}
