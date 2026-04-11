import CalendarView from "@/components/CalendarView";

export default function CalendarPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">View your tasks and events</p>
        </div>
      </div>
      <CalendarView />
    </div>
  );
}