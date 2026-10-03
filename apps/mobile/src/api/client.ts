import axios from 'axios';
import { getApiBaseUrl } from '../config';
import { getItem } from '../storage';

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
});

api.interceptors.request.use(async config => {
  const token = await getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type AuthUser = {
  userId: number;
  email: string;
  fullName: string;
  token: string;
  isSolver?: boolean;
  userName?: string;
};

export async function login(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>('/auth/login', { email, password });
  return data;
}

export async function register(payload: {
  email: string;
  password: string;
  flname: string;
  isSeeker: boolean;
  isSolver: boolean;
}): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>('/auth/register', payload);
  return data;
}
