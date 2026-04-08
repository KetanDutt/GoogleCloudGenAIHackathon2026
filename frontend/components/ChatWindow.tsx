"use client";

import { useAppStore } from "@/store/useAppStore";
import { Send, User, Bot, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import "regenerator-runtime/runtime";
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import toast from 'react-hot-toast';
import { Copy, AlertCircle, RefreshCw } from 'lucide-react';

export function MessageBubble({ role, content, timestamp, intent, isError, onRetry }: { role: string; content: string; timestamp: string; intent?: string, isError?: boolean, onRetry?: () => void }) {
  const isUser = role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className={clsx("flex w-full mt-4 space-x-3 max-w-2xl group", isUser ? "ml-auto justify-end" : "")}
    >
      {!isUser && (
        <div className={clsx("flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center", isError ? "bg-red-100 dark:bg-red-900" : "bg-indigo-100 dark:bg-indigo-900")}>
          {isError ? <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-300" /> : <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />}
        </div>
      )}
      <div>
        <div
          className={clsx(
            "p-3 rounded-2xl text-sm shadow-sm prose prose-sm max-w-none dark:prose-invert relative",
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm prose-p:text-white prose-a:text-white"
              : isError
              ? "bg-red-50 border border-red-200 text-red-800 rounded-tl-sm dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-200"
              : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-100"
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        <div className={clsx("flex items-center gap-2 mt-1 px-1", isUser && "justify-end")}>
          <span className="text-[10px] text-gray-400">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {intent && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              {intent} agent
            </span>
          )}
          {!isUser && (
             <div className="flex gap-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={handleCopy} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Copy response">
                  <Copy className="w-3.5 h-3.5" />
               </button>
               {isError && onRetry && (
                 <button onClick={onRetry} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Retry">
                    <RefreshCw className="w-3.5 h-3.5" />
                 </button>
               )}
             </div>
          )}
        </div>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900">
          <User className="w-5 h-5 text-blue-600 dark:text-blue-300" />
        </div>
      )}
    </motion.div>
  );
}

export default function ChatWindow() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, isLoading, activeAgent, availableModels, selectedModel, setSelectedModel, loadModels } = useAppStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const toggleListening = () => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (listening) {
      SpeechRecognition.stopListening();
    }

    const text = input.trim();
    setInput("");
    resetTranscript();
    await sendMessage(text);
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto rounded-2xl overflow-hidden bg-gray-50/50 border border-gray-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
      {availableModels && availableModels.length > 0 && (
        <div className="flex justify-end p-2 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white px-2 py-1"
          >
            {availableModels.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <AnimatePresence>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
              <Bot className="w-12 h-12 opacity-50" />
              <p className="text-sm">Hi, I&apos;m your AI Personal Operations Manager.</p>
              <div className="flex gap-2 flex-wrap justify-center max-w-md">
                <span className="text-xs bg-white border rounded-full px-3 py-1 cursor-pointer hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700" onClick={() => setInput("Plan my week for exams")}>&quot;Plan my week for exams&quot;</span>
                <span className="text-xs bg-white border rounded-full px-3 py-1 cursor-pointer hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700" onClick={() => setInput("Summarize this meeting: ...")}>&quot;Summarize a meeting&quot;</span>
                <span className="text-xs bg-white border rounded-full px-3 py-1 cursor-pointer hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700" onClick={() => setInput("Add task: Finish project by Friday")}>&quot;Add task&quot;</span>
              </div>
            </div>
          ) : (
            messages.map((msg: { id: string; role: string; content: string; timestamp: string; intent?: string, isError?: boolean, lastUserMessage?: string }) => (
              <MessageBubble key={msg.id} {...msg} onRetry={msg.isError && msg.lastUserMessage ? () => sendMessage(msg.lastUserMessage as string) : undefined} />
            ))
          )}
        </AnimatePresence>

        {isLoading && (
          <div className="flex items-center gap-3 mt-4 text-gray-400">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center dark:bg-indigo-900">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="bg-white p-3 rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm text-sm flex items-center gap-2 dark:bg-zinc-800 dark:border-zinc-700">
              {activeAgent ? (
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span> {activeAgent} is working...</span>
              ) : (
                <span className="flex space-x-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                </span>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to plan, take notes, or manage your schedule..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
            disabled={isLoading}
          />
          {browserSupportsSpeechRecognition && (
            <button
              type="button"
              onClick={toggleListening}
              className={clsx(
                "p-3 rounded-xl transition-colors",
                listening ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 animate-pulse" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
              )}
              title={listening ? "Stop listening" : "Start dictation"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
