import ChatWindow from "@/components/ChatWindow";

export default function ChatPage() {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">AI Chat</h1>
        <p className="text-gray-500 mt-2">Interact with your personal operations manager directly.</p>
      </header>

      <section className="h-[750px]">
        <ChatWindow />
      </section>
    </>
  );
}
