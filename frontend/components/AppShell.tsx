"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useSystemStatus } from "@/lib/queries";
import Sidebar, { navItems } from "./Sidebar";
import SearchDialog from "./SearchDialog";
import { Badge } from "./ui/Primitives";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { data: status } = useSystemStatus();
  if (["/login", "/register"].includes(pathname))
    return <main id="main-content">{children}</main>;
  const title =
    navItems.find((item) => item.href === pathname)?.label || "Settings";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="desktop-sidebar">
        <Sidebar />
      </aside>
      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] overflow-y-auto bg-surface">
            <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
            <Dialog.Description className="sr-only">
              Your workspace pages and account settings.
            </Dialog.Description>
            <Dialog.Close
              className="icon-button absolute right-2 top-2"
              aria-label="Close menu"
            >
              <X size={18} />
            </Dialog.Close>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="app-main">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="icon-button lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <div className="hidden items-center gap-2 text-xs sm:flex">
              <span className="text-muted">Workspace</span>
              <span className="mx-1 text-muted/50">/</span>
              <span className="font-medium">{title}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SearchDialog />
            <div className="hidden h-5 w-px bg-line sm:block" />
            <Badge tone={status?.ai_mode === "vertex" ? "teal" : "amber"}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {status?.ai_mode === "demo"
                ? "Demo mode"
                : status?.ai_mode === "vertex"
                  ? "Vertex AI"
                  : status?.ai_mode === "disabled"
                    ? "AI off"
                    : "Connecting"}
            </Badge>
            <button
              className="icon-button"
              aria-label="Toggle color theme"
              title="Toggle color theme"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              <Moon className="h-[18px] w-[18px] dark:hidden" />
              <Sun className="hidden h-[18px] w-[18px] dark:block" />
            </button>
          </div>
        </header>
        <main id="main-content" className="page-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>A little more organized. A little more you.</span>
          <span>
            AI Ops Workspace <span className="mx-1 text-line">·</span> v2.0
          </span>
        </footer>
      </div>
    </div>
  );
}
