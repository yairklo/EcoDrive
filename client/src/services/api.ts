import axios from 'axios';
import { getToken } from './auth';
import Constants from 'expo-constants';

const debuggerHost = Constants.expoConfig?.hostUri;
const API_URL = debuggerHost ? `http://${debuggerHost.split(':')[0]}:3000` : 'http://10.0.2.2:3000'; 

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
