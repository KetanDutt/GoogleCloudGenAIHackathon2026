"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { CheckSquare, StickyNote, Activity, Calendar, PlayCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

const TEST_PROMPTS = [
  "Add a note: Always review lecture slides before the exam.",
  "Add a note: Remember to bring extra pencils for the test.",
  "Add a task: Buy groceries tomorrow.",
  "Add a task: Finish writing the history paper due next Tuesday.",
  "Schedule an event: Doctor's appointment on Friday at 10 AM.",
  "Schedule an event: Group study session on Saturday at 4 PM.",
  "Create a study plan for my final exams next week",
  "Add a study session to my calendar for tomorrow at 2 PM",
  "Save this note: Important study tip is to take breaks every 45 minutes",
  "Remind me to review the notes later today"
];

export default function Home() {
  const { tasks, notes, events, systemHealth, loadTasks, loadNotes, loadEvents, loadHealth, sendMessage } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadTasks();
    loadNotes();
    loadEvents();
    loadHealth();
    setMounted(true);
  }, [loadTasks, loadNotes, loadEvents, loadHealth]);

  if (!mounted) return null;

  const runTestFlow = async () => {
    setIsTesting(true);
    console.log("=== STARTING E2E TEST FLOW ===");
    try {
      for (let i = 0; i < TEST_PROMPTS.length; i++) {
        const prompt = TEST_PROMPTS[i];
        console.log(`[Test ${i + 1}/${TEST_PROMPTS.length}] Sending prompt: "${prompt}"`);
        await sendMessage(prompt);
        console.log(`[Test ${i + 1}/${TEST_PROMPTS.length}] Completed.`);

        // Wait a short moment between prompts
        if (i < TEST_PROMPTS.length - 1) {
           await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      console.log("=== E2E TEST FLOW COMPLETED SUCCESSFULLY ===");
    } catch (error) {
      console.error("=== E2E TEST FLOW FAILED ===", error);
    } finally {
      setIsTesting(false);
    }
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalNotes = notes.length;

  return (
    <>
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 mt-2">Welcome to your AI Personal Operations Manager. Here is a summary of your activities.</p>
        </div>
        {process.env.NEXT_PUBLIC_ENABLE_TEST_FLOW === 'true' && (
          <button
            onClick={runTestFlow}
            disabled={isTesting}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running Test Flow...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                Run Test Flow
              </>
            )}
          </button>
        )}
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

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl dark:bg-purple-900/30 dark:text-purple-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">System Status</h3>
              <p className={clsx("text-lg font-bold", systemHealth?.status === 'ok' ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                 {systemHealth?.status === 'ok' ? 'Online' : 'Degraded / Error'}
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-500 flex flex-col gap-1.5 mt-2">
             <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg dark:bg-zinc-800">
               <span>BigQuery (Tasks/Notes):</span>
               <span className={clsx("font-medium px-2 py-0.5 rounded-full text-[10px] uppercase", systemHealth?.bigquery === 'connected' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : systemHealth?.bigquery === 'mocked' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                 {systemHealth?.bigquery || 'checking...'}
               </span>
             </div>
             <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg dark:bg-zinc-800">
               <span>Vertex AI (Agents):</span>
               <span className={clsx("font-medium px-2 py-0.5 rounded-full text-[10px] uppercase", systemHealth?.vertex_ai === 'connected' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                 {systemHealth?.vertex_ai || 'checking...'}
               </span>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-500"/> Recent Tasks
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

        <section>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500"/> Calendar
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
            {events.length === 0 ? (
               <div className="p-6 text-center text-gray-500">No events scheduled yet.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {events.map(event => (
                  <div key={event.id || event.title} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                     <div>
                       <p className="font-medium text-gray-800 dark:text-gray-200">{event.title}</p>
                       <p className="text-xs text-gray-500 mt-1">
                         {new Date(event.start_time).toLocaleString()} - {new Date(event.end_time).toLocaleString()}
                       </p>
                     </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
