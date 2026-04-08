"use client";

import { useAppStore } from "@/store/useAppStore";
import { User, Server, Database, Bot, Cog, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export default function WorkflowVisualizer() {
  const { workflowStep, activeAgent, agentTrace } = useAppStore();

  const steps = [
    { id: "idle", label: "User Input", icon: User },
    { id: "orchestrating", label: "Orchestrator", icon: Server },
    { id: "processing", label: "Agent Processing", icon: Bot, dynamicLabel: activeAgent },
    { id: "saving", label: "Tool Execution", icon: Cog },
    { id: "done", label: "Database Sync", icon: Database },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === workflowStep);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-4xl mx-auto dark:bg-zinc-900 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-8 flex items-center gap-2 dark:text-gray-300">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Live Execution Flow
      </h3>

      <div className="relative flex justify-between items-center w-full max-w-2xl mx-auto pb-10">
        {/* Connection Lines */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -z-10 -translate-y-1/2 rounded-full dark:bg-zinc-800" />
        <motion.div
          className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 -z-10 -translate-y-1/2 rounded-full shadow-md"
          initial={{ width: "0%" }}
          animate={{
            width: `${(Math.max(0, currentStepIndex) / (steps.length - 1)) * 100}%`,
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isPast = index < currentStepIndex;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative flex flex-col items-center">
              <motion.div
                className={clsx(
                  "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors z-10",
                  isActive
                    ? "bg-white border-blue-500 shadow-lg scale-110 dark:bg-zinc-900"
                    : isPast
                    ? "bg-blue-500 border-blue-500 text-white shadow-md dark:border-blue-600"
                    : "bg-white border-gray-200 text-gray-400 dark:bg-zinc-800 dark:border-zinc-700"
                )}
                animate={{
                  scale: isActive ? 1.15 : 1,
                }}
              >
                <Icon
                  className={clsx(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-blue-500 animate-pulse" : isPast ? "text-white" : ""
                  )}
                />
              </motion.div>

              <div className="absolute top-16 text-center w-32 left-1/2 -translate-x-1/2">
                <span
                  className={clsx(
                    "text-xs font-semibold uppercase tracking-wider transition-colors",
                    isActive ? "text-blue-600 dark:text-blue-400" : isPast ? "text-gray-600 dark:text-gray-400" : "text-gray-400"
                  )}
                >
                  {step.dynamicLabel && isActive ? step.dynamicLabel : step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {agentTrace && agentTrace.length > 0 && (
        <div className="mt-8 w-full">
           <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2 dark:text-gray-400">
             <Activity className="w-4 h-4" /> Execution Trace
           </h4>
           <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 max-h-48 overflow-y-auto custom-scrollbar dark:bg-zinc-950/50 dark:border-zinc-800">
              <AnimatePresence>
                {agentTrace.map((trace, idx) => (
                   <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-start gap-3 mb-3 last:mb-0"
                   >
                     <span className="text-[10px] font-mono text-gray-400 mt-1 whitespace-nowrap">
                        [{String(idx + 1).padStart(2, '0')}]
                     </span>
                     <div>
                       <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mr-2">
                         {trace.step}
                       </span>
                       <span className="text-xs text-gray-600 dark:text-gray-300">
                         {trace.details}
                       </span>
                     </div>
                   </motion.div>
                ))}
              </AnimatePresence>
           </div>
        </div>
      )}
    </div>
  );
}
