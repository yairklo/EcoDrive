import axios from 'axios';
import { getToken } from './auth';

// Use local machine IP for testing React Native on physical device/emulator
const API_URL = 'http://10.0.2.2:3000'; 

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
