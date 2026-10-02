import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AuthUser, login as apiLogin, register as apiRegister } from '../api/client';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: {
    email: string;
    password: string;
    flname: string;
    isSeeker: boolean;
    isSolver: boolean;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistSession(user: AuthUser) {
  await SecureStore.setItemAsync('token', user.token);
  await SecureStore.setItemAsync('user', JSON.stringify(user));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const raw = await SecureStore.getItemAsync('user');
    if (!raw) {
      setUser(null);
      return;
    }
    setUser(JSON.parse(raw) as AuthUser);
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await apiLogin(email, password);
    await persistSession(session);
    setUser(session);
    router.replace('/(tabs)/home');
  }, []);

  const signUp = useCallback(
    async (payload: {
      email: string;
      password: string;
      flname: string;
      isSeeker: boolean;
      isSolver: boolean;
    }) => {
      const session = await apiRegister(payload);
      await persistSession(session);
      setUser(session);
      router.replace('/(tabs)/home');
    },
    []
  );

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user');
    setUser(null);
    router.replace('/login');
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refreshUser }),
    [user, loading, signIn, signUp, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
