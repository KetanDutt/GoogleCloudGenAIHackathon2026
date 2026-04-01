import ChatWindow from "@/components/ChatWindow";
import WorkflowVisualizer from "@/components/WorkflowVisualizer";

export default function Home() {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 mt-2">Welcome to your AI Personal Operations Manager.</p>
      </header>

      <section className="mb-12">
        <WorkflowVisualizer />
      </section>

      <section className="h-[600px]">
        <ChatWindow />
      </section>
    </>
  );
}
