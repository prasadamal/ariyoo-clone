import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthUser, Profile, fetchProfile, login as apiLogin, register as apiRegister, setSessionEndedHandler } from '../api/client';
import { registerForPush, unregisterPush } from '../notifications';
import { deleteItem, getItem, setItem } from '../storage';
import { setSavedOwner } from '../lib/savedAnswers';

type SignUp = { email: string; password: string; flname: string; isSeeker: boolean; isSolver: boolean; acceptedTerms: true };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: SignUp) => Promise<void>;
  /** `remote: false` skips server calls (used after the account has been deleted). */
  signOut: (options?: { remote?: boolean }) => Promise<void>;
  /** Stores profile changes the server has confirmed. */
  applyProfile: (profile: Profile) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistSession(user: AuthUser) {
  await setItem('token', user.token);
  await setItem('user', JSON.stringify(user));
}

function readStored(raw: string | null): AuthUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUser;
    return parsed && typeof parsed.token === 'string' && Number.isSafeInteger(parsed.userId) ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const current = useRef<AuthUser | null>(null);
  current.current = user;

  const clear = useCallback(async () => {
    await deleteItem('token');
    await deleteItem('user');
    setUser(null);
    router.replace('/login');
  }, []);

  const applyProfile = useCallback(async (profile: Profile) => {
    const signedIn = current.current;
    // Ignore an answer that arrives after sign-out or for a different account.
    if (!signedIn || signedIn.userId !== profile.userId) return;
    const next = { ...signedIn, ...profile };
    await setItem('user', JSON.stringify(next));
    setUser(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = readStored(await getItem('user'));
      if (cancelled) return;
      setUser(stored);
      setLoading(false);
      if (!stored) return;
      // The saved copy may be stale (role changed on another device, account removed).
      // A 401 here signs the app out through the handler below; being offline changes nothing.
      fetchProfile().then(profile => { if (!cancelled) void applyProfile(profile); }).catch(() => undefined);
      void registerForPush(false);
    })();
    return () => { cancelled = true; };
  }, [applyProfile]);

  // Saved answers belong to whoever is signed in; switching accounts starts from an empty set.
  useEffect(() => {
    setSavedOwner(user?.userId ?? null);
  }, [user?.userId]);

  useEffect(() => {
    setSessionEndedHandler(() => { if (current.current) void clear(); });
    return () => setSessionEndedHandler(null);
  }, [clear]);

  const start = useCallback(async (session: AuthUser) => {
    await persistSession(session);
    setUser(session);
    router.replace('/(tabs)/home');
    void registerForPush(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => start(await apiLogin(email, password)), [start]);
  const signUp = useCallback(async (payload: SignUp) => start(await apiRegister(payload)), [start]);

  const signOut = useCallback(async (options?: { remote?: boolean }) => {
    if (options?.remote !== false) await unregisterPush();
    else await deleteItem('push_token');
    await clear();
  }, [clear]);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, applyProfile }),
    [user, loading, signIn, signUp, signOut, applyProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
