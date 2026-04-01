"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { StickyNote, RotateCw, RefreshCcw } from "lucide-react";
import clsx from "clsx";

export default function NotesPanel() {
  const { notes, loadNotes, isLoading } = useAppStore();

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-4xl mx-auto dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-6 border-b pb-4 border-gray-100 dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-emerald-500" /> My Notes
          </h2>
          <p className="text-sm text-gray-500 mt-1">Review summaries and action items.</p>
        </div>
        <button
          onClick={loadNotes}
          disabled={isLoading}
          className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
        >
          <RotateCw className={clsx("w-5 h-5", isLoading && "animate-spin")} />
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-12">
          <StickyNote className="w-12 h-12 mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No notes saved.</p>
          <p className="text-sm text-gray-400 mt-1">Try asking to summarize a meeting.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notes.map((note, idx) => (
            <div
              key={note.id || idx}
              className="p-5 rounded-2xl border border-gray-100 bg-gray-50/50 hover:shadow-md transition-shadow dark:bg-zinc-800/50 dark:border-zinc-700"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full dark:bg-emerald-900/50 dark:text-emerald-300">
                  {new Date(note.created_at || "").toLocaleDateString()}
                </span>
              </div>

              {note.summary && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1 dark:text-gray-300">
                    <RefreshCcw className="w-3.5 h-3.5" /> Summary
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed dark:text-gray-400">
                    {note.summary}
                  </p>
                </div>
              )}

              {note.action_items && note.action_items.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300">Action Items</h4>
                  <ul className="space-y-2">
                    {note.action_items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!note.summary && (!note.action_items || note.action_items.length === 0) && (
                <p className="text-sm text-gray-500 italic mt-2 line-clamp-3">
                  {note.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
