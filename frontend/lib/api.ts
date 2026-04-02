import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export const sendChatRequest = async (userInput: string, userId: string = "default_user") => {
  const response = await api.post('/chat', { user_input: userInput, user_id: userId });
  return response.data;
};

export const fetchTasks = async (userId: string = "default_user") => {
  const response = await api.get(`/tasks?user_id=${userId}`);
  return response.data;
};

export const fetchNotes = async (userId: string = "default_user") => {
  const response = await api.get(`/notes?user_id=${userId}`);
  return response.data;
};

export const completeTaskAPI = async (taskName: string, userId: string = "default_user") => {
  const response = await api.put('/tasks/complete', { user_id: userId, task_name: taskName });
  return response.data;
};
