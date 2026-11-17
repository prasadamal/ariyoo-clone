import axios, { AxiosError } from 'axios';
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

// The account was deleted, suspended or the 7-day sign-in ran out: AuthContext signs the app out.
let onSessionEnded: (() => void) | null = null;
export function setSessionEndedHandler(handler: (() => void) | null) {
  onSessionEnded = handler;
}
api.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    if (error.response?.status === 401 && !url.startsWith('/auth/') && error.config?.method !== 'delete') onSessionEnded?.();
    return Promise.reject(error);
  },
);

/** The server's own words when it sent some, otherwise `fallback`. */
export function errorMessage(e: unknown, fallback: string): string {
  const data = (e as AxiosError<{ message?: string }>)?.response?.data;
  if (data?.message) return data.message;
  if ((e as AxiosError)?.code === 'ERR_NETWORK' || (e as AxiosError)?.code === 'ECONNABORTED') {
    return 'No connection. Check your internet and try again.';
  }
  return fallback;
}

export function errorCode(e: unknown): string | undefined {
  return (e as AxiosError<{ code?: string }>)?.response?.data?.code;
}

export type Profile = {
  userId: number;
  email: string;
  fullName: string;
  userName?: string | null;
  isSolver?: boolean;
  isSeeker?: boolean;
};
export type AuthUser = Profile & { token: string };

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
  acceptedTerms: true;
}): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>('/auth/register', payload);
  return data;
}

export async function fetchProfile(): Promise<Profile> {
  const { data } = await api.get<Profile>('/api/user/me');
  return data;
}
