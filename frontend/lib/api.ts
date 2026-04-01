import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
