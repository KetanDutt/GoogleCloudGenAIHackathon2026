import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Ops Manager",
  description: "Multi-Agent System for Managing Tasks, Notes, and Calendars",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 flex h-screen overflow-hidden text-gray-900 dark:bg-zinc-950 dark:text-gray-100`}>
        <Sidebar />
        <main className="flex-1 h-full overflow-y-auto custom-scrollbar">
          <div className="p-8 max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
