import { create } from 'zustand';
import { sendChatRequest, fetchTasks, fetchNotes, completeTaskAPI, fetchHealth, fetchUserMeAPI, fetchModelsAPI, fetchEvents } from '../lib/api';
import toast from 'react-hot-toast';

export interface User {
  email: string;
  username: string;
  avatar: string;
}

export interface Task {
  id?: string;
  user_id: string;
  task_name: string;
  deadline?: string;
  created_at?: string;
  status?: string; // Optional for UI tracking
}

export interface Note {
  id?: string;
  user_id: string;
  content: string;
  summary?: string;
  action_items?: string[];
  created_at?: string;
}

export interface Event {
  id?: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  created_at?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  intent?: string;
  isError?: boolean;
  lastUserMessage?: string;
}

export interface AgentTraceStep {
  step: string;
  details: string;
}

interface AppState {
  token: string | null;
  user: User | null;
  messages: Message[];
  tasks: Task[];
  notes: Note[];
  events: Event[];
  isLoading: boolean;
  activeAgent: string | null;
  workflowStep: 'idle' | 'orchestrating' | 'processing' | 'saving' | 'done';
  agentTrace: AgentTraceStep[];
  systemHealth: { status: string; bigquery: string; vertex_ai: string } | null;
  availableModels: string[];
  selectedModel: string;
  setToken: (token: string | null) => void;
  loadUser: () => Promise<void>;
  logout: () => void;
  addMessage: (msg: Message) => void;
  sendMessage: (text: string) => Promise<void>;
  loadTasks: () => Promise<void>;
  loadNotes: () => Promise<void>;
  loadEvents: () => Promise<void>;
  completeTask: (taskName: string) => Promise<void>;
  loadHealth: () => Promise<void>;
  loadModels: () => Promise<void>;
  setSelectedModel: (model: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  user: null,
  messages: [],
  tasks: [],
  notes: [],
  events: [],
  isLoading: false,
  activeAgent: null,
  workflowStep: 'idle',
  agentTrace: [],
  systemHealth: null,
  availableModels: [],
  selectedModel: "gemini-2.5-flash-lite",

  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
      set({ token });
      get().loadUser();
    } else {
      localStorage.removeItem('token');
      set({ token, user: null });
    }
  },

  loadUser: async () => {
    try {
      const user = await fetchUserMeAPI();
      set({ user });
    } catch (error) {
      console.error('Failed to load user', error);
      get().logout();
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, messages: [], tasks: [], notes: [], events: [] });
  },

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  sendMessage: async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    get().addMessage(userMsg);
    set({ isLoading: true, workflowStep: 'orchestrating', activeAgent: 'Orchestrator', agentTrace: [] });

    try {
      const response = await sendChatRequest(text, get().selectedModel);

      const intent = response.intent;
      const trace = response.trace || [];

      set({
          activeAgent: intent.charAt(0).toUpperCase() + intent.slice(1),
          workflowStep: 'done',
          agentTrace: trace
      });

      let contentStr = '';
      if (typeof response.response === 'object') {
        contentStr = JSON.stringify(response.response, null, 2);
      } else {
        contentStr = String(response.response);
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Executed via ${intent} agent. \n\n${contentStr}`,
        timestamp: new Date().toISOString(),
        intent,
      };

      get().addMessage(aiMsg);
      set({ isLoading: false, activeAgent: null });

      // Refresh data
      if (intent === 'planner' || intent === 'calendar') {
        get().loadTasks();
        get().loadEvents();
      } else if (intent === 'notes') {
        get().loadNotes();
      }

      // Reset workflow visualizer after a bit
      setTimeout(() => set({ workflowStep: 'idle' }), 2000);

    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        isError: true,
        lastUserMessage: text,
      };
      get().addMessage(errorMsg);
      set({ isLoading: false, workflowStep: 'idle', activeAgent: null });
      toast.error('Failed to process message');
    }
  },

  loadTasks: async () => {
    try {
      const data = await fetchTasks();
      set({ tasks: data });
    } catch (error) {
      console.error('Failed to load tasks', error);
      toast.error('Failed to load tasks');
    }
  },

  completeTask: async (taskName: string) => {
    try {
      // Optimistic update
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.task_name === taskName ? { ...t, status: 'completed' } : t
        )
      }));
      await completeTaskAPI(taskName);
      toast.success('Task marked as completed');
    } catch (error) {
      console.error('Failed to complete task', error);
      toast.error('Failed to update task');
      // Revert on error
      get().loadTasks();
    }
  },

  loadNotes: async () => {
    try {
      const data = await fetchNotes();
      // Handle json parsing for action_items if it's stored as string
      const parsedNotes = data.map((n: { id?: string; user_id: string; content: string; summary?: string; action_items?: string | string[]; created_at?: string }) => ({
        ...n,
        action_items: typeof n.action_items === 'string' ? JSON.parse(n.action_items) : n.action_items,
      }));
      set({ notes: parsedNotes });
    } catch (error) {
      console.error('Failed to load notes', error);
    }
  },

  loadEvents: async () => {
    try {
      const data = await fetchEvents();
      set({ events: data });
    } catch (error) {
      console.error('Failed to load events', error);
    }
  },

  loadHealth: async () => {
    try {
      const data = await fetchHealth();
      set({ systemHealth: data });
    } catch (error) {
      console.error('Failed to fetch health status', error);
      set({ systemHealth: { status: 'error', bigquery: 'disconnected', vertex_ai: 'disconnected' } });
    }
  },

  loadModels: async () => {
    try {
      const data = await fetchModelsAPI();
      set({ availableModels: data.models || [] });
    } catch (error) {
      console.error('Failed to fetch models', error);
    }
  },

  setSelectedModel: (model: string) => {
    set({ selectedModel: model });
  },
}));
