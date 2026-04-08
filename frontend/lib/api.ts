import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to catch common API errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If it's a network error or CORS issue (no response object)
    if (!error.response) {
       toast.error("Network error: Could not connect to the backend server.", { id: 'network-err' });
       return Promise.reject(error);
    }

    // If we get an error response back from the server (e.g. 500)
    const status = error.response.status;
    if (status >= 500) {
       toast.error("Server error: The backend encountered an unexpected issue.", { id: 'server-err' });
    } else if (status >= 400) {
       // Optional: Could display 400s specifically if needed, but keeping it general
       console.warn("Client error occurred:", error.response.data);
    }

    return Promise.reject(error);
  }
);

export const loginAPI = async (email: string, password: string) => {
  const response = await api.post('/login', { email, password });
  return response.data;
};

export const fetchUserMeAPI = async () => {
  const response = await api.get('/users/me');
  return response.data;
};

export const registerAPI = async (email: string, password: string, username: string, avatar: string) => {
  const response = await api.post('/register', { email, password, username, avatar });
  return response.data;
};

export const sendChatRequest = async (userInput: string, modelName?: string) => {
  const payload: Record<string, string> = { user_input: userInput };
  if (modelName) {
    payload.model_name = modelName;
  }
  const response = await api.post('/chat', payload);
  return response.data;
};

export const fetchModelsAPI = async () => {
  const response = await api.get('/models');
  return response.data;
};

export const fetchTasks = async () => {
  const response = await api.get(`/tasks`);
  return response.data;
};

export const fetchNotes = async () => {
  const response = await api.get(`/notes`);
  return response.data;
};

export const completeTaskAPI = async (taskName: string) => {
  const response = await api.put('/tasks/complete', { task_name: taskName });
  return response.data;
};

export const fetchHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};
