import NotesPanel from "@/components/NotesPanel";

export default function NotesPage() {
  return (
    <>
      <header className="mb-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Notes</h1>
        <p className="text-gray-500 mt-2">View summarized content and action items from your meetings.</p>
      </header>

      <section>
        <NotesPanel />
      </section>
    </>
  );
}
