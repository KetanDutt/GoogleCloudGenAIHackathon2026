import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import Providers from "@/components/Providers";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: {
    default: "AI Ops — Your personal workspace",
    template: "%s | AI Ops",
  },
  description:
    "Bring your tasks, notes, calendar, and ideas together. A thoughtful personal workspace with a review-before-save AI assistant.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  themeColor: "#0c7969",
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
