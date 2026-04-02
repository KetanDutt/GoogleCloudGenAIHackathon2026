import ChatWindow from "@/components/ChatWindow";
import WorkflowVisualizer from "@/components/WorkflowVisualizer";

export default function ChatPage() {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">AI Chat</h1>
        <p className="text-gray-500 mt-2">Interact with your personal operations manager directly.</p>
      </header>

      <section className="mb-8">
        <WorkflowVisualizer />
      </section>

      <section className="h-[600px]">
        <ChatWindow />
      </section>
    </>
  );
}
