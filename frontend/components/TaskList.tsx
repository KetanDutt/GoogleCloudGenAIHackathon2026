"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { CheckCircle2, Clock, RotateCw, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export default function TaskList() {
  const { tasks, loadTasks, isLoading } = useAppStore();

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-4xl mx-auto dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-6 border-b pb-4 border-gray-100 dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-500" /> My Tasks
          </h2>
          <p className="text-sm text-gray-500 mt-1">Manage and track your action items.</p>
        </div>
        <button
          onClick={loadTasks}
          disabled={isLoading}
          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
          title="Refresh Tasks"
        >
          <RotateCw className={clsx("w-5 h-5", isLoading && "animate-spin")} />
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No tasks found.</p>
          <p className="text-sm text-gray-400 mt-1">Ask the AI to plan your day!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {tasks.map((task, index) => (
              <motion.div
                key={task.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="group flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all bg-gray-50/30 dark:bg-zinc-800/50 dark:border-zinc-800 dark:hover:border-indigo-500/30"
              >
                <div className="pt-1">
                  <div className="w-5 h-5 rounded-md border-2 border-gray-300 flex items-center justify-center cursor-pointer group-hover:border-indigo-500 transition-colors">
                    <CheckCircle2 className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800 dark:text-gray-200">{task.task_name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {task.deadline && (
                      <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md dark:bg-zinc-700">
                        <Clock className="w-3 h-3" />
                        Deadline: {new Date(task.deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                    {task.created_at && (
                      <span className="flex items-center gap-1">
                        Created: {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
