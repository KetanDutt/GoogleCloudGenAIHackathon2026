"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckSquare, StickyNote, Video } from "lucide-react";
import clsx from "clsx";

export default function CalendarView() {
  const { tasks, notes, events, loadTasks, loadNotes, loadEvents } = useAppStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadTasks();
    loadNotes();
    loadEvents();
  }, [loadTasks, loadNotes, loadEvents]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const startDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getItemsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];

    const dayTasks = tasks.filter(t => t.deadline && t.deadline.startsWith(dateStr));
    const dayNotes = notes.filter(n => n.created_at && n.created_at.startsWith(dateStr));
    const dayEvents = events.filter(e => e.start_time && e.start_time.startsWith(dateStr));

    return { dayTasks, dayNotes, dayEvents };
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
          <CalendarIcon className="w-6 h-6 text-indigo-500" />
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
            <ChevronLeft className="w-5 h-5 dark:text-gray-300" />
          </button>
          <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
            <ChevronRight className="w-5 h-5 dark:text-gray-300" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-zinc-700 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-gray-50 dark:bg-zinc-800 p-2 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">
            {day}
          </div>
        ))}

        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-white dark:bg-zinc-900 min-h-[120px]" />
        ))}

        {daysInMonth.map((date, i) => {
          const { dayTasks, dayNotes, dayEvents } = getItemsForDate(date);
          const isToday = date.toDateString() === new Date().toDateString();

          return (
            <div key={i} className={clsx(
              "bg-white dark:bg-zinc-900 min-h-[120px] p-2 flex flex-col gap-1 relative group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors border-t border-l border-gray-100 dark:border-zinc-800",
              isToday && "bg-indigo-50/30 dark:bg-indigo-900/10"
            )}>
              <span className={clsx(
                "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1",
                isToday ? "bg-indigo-500 text-white" : "text-gray-700 dark:text-gray-300"
              )}>
                {date.getDate()}
              </span>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {dayEvents.map((event, idx) => (
                  <div key={`event-${idx}`} className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded truncate flex items-center gap-1" title={event.title}>
                    <Video className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{event.title}</span>
                  </div>
                ))}
                {dayTasks.map((task, idx) => (
                  <div key={`task-${idx}`} className={clsx(
                    "text-xs px-2 py-1 rounded truncate flex items-center gap-1",
                    task.status === 'completed' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 line-through opacity-70" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                  )} title={task.task_name}>
                    <CheckSquare className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{task.task_name}</span>
                  </div>
                ))}
                {dayNotes.map((note, idx) => (
                  <div key={`note-${idx}`} className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded truncate flex items-center gap-1" title={note.summary || note.content}>
                    <StickyNote className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{note.summary || "Note"}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}