"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { CheckSquare, StickyNote, Activity, Calendar } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

export default function Home() {
  const { tasks, notes, loadTasks, loadNotes } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadTasks();
    loadNotes();
    setMounted(true);
  }, [loadTasks, loadNotes]);

  if (!mounted) return null;

  const pendingTasks = tasks.filter(t => t.status !== 'completed').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalNotes = notes.length;

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 mt-2">Welcome to your AI Personal Operations Manager. Here is a summary of your activities.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link href="/tasks" className="block">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl dark:bg-blue-900/30 dark:text-blue-400">
                <CheckSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Tasks</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingTasks}</p>
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-2">
              <span className="text-emerald-500 font-medium">{completedTasks} completed</span> tasks
            </div>
          </div>
        </Link>

        <Link href="/notes" className="block">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl dark:bg-emerald-900/30 dark:text-emerald-400">
                <StickyNote className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Notes</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalNotes}</p>
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Action items extracted from meetings
            </div>
          </div>
        </Link>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl dark:bg-purple-900/30 dark:text-purple-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">System Status</h3>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Online</p>
            </div>
          </div>
          <div className="text-sm text-gray-500 mt-2">
            All agents operational
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-500"/> Recent Tasks
        </h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
          {tasks.length === 0 ? (
             <div className="p-6 text-center text-gray-500">No tasks created yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {tasks.slice(0, 5).map(task => (
                <div key={task.id || task.task_name} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                   <div>
                     <p className={clsx("font-medium", task.status === 'completed' ? "text-gray-400 line-through" : "text-gray-800 dark:text-gray-200")}>{task.task_name}</p>
                     {task.deadline && <p className="text-xs text-gray-500 mt-1">Due: {new Date(task.deadline).toLocaleDateString()}</p>}
                   </div>
                   <span className={clsx("px-2 py-1 text-xs rounded-full", task.status === 'completed' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400")}>
                     {task.status || "pending"}
                   </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
