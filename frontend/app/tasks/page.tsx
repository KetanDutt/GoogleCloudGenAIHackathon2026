import TaskList from "@/components/TaskList";

export default function TasksPage() {
  return (
    <>
      <header className="mb-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Tasks</h1>
        <p className="text-gray-500 mt-2">Manage all generated action items and deadlines.</p>
      </header>

      <section>
        <TaskList />
      </section>
    </>
  );
}
