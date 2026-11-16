import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../config';
import { countTrips, wipeLocalData } from '../lib/localDb';
import { isGuestMode, setGuestMode } from '../lib/session';
import { supabase } from '../lib/supabase';
import { getLocalOwner, setLocalOwner } from '../lib/sync';
import { fetchMyProfile, touchLastActive } from '../social/profiles';
import type { MyProfile } from '../social/types';

type SignUpResult = { needsConfirmation: boolean };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: MyProfile | null;
  loading: boolean;
  /** Cloud is not configured in this build: journal-only mode. */
  offlineMode: boolean;
  /** Signed out but chose to use the journal without an account. */
  guest: boolean;
  /** Signed in, but this device's journal belongs to another account. */
  ownerConflict: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, username?: string) => Promise<SignUpResult>;
  signOut: (opts?: { wipeLocal?: boolean }) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resolveOwnerConflict: (choice: 'wipe' | 'signout') => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);
  const [ownerConflict, setOwnerConflict] = useState(false);
  const offlineMode = !isSupabaseConfigured;
  const userId = session?.user?.id ?? null;
  const lastUser = useRef<string | null>(null);
  const currentUser = useRef(userId);
  currentUser.current = userId;

  const refreshProfile = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    try {
      const next = await fetchMyProfile(userId);
      if (currentUser.current === userId) setProfile(next);
    } catch {
      // keep the last known profile when offline
    }
  }, [userId]);

  useEffect(() => {
    isGuestMode().then(setGuest);
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  // When a traveller signs in: adopt guest journals, or flag another account's journals.
  useEffect(() => {
    if (!userId || lastUser.current === userId) return;
    lastUser.current = userId;
    (async () => {
      const owner = await getLocalOwner();
      if (owner && owner !== userId) {
        if ((await countTrips()) > 0) setOwnerConflict(true);
        else await setLocalOwner(userId);
      } else if (!owner) {
        await setLocalOwner(userId);
      }
      await setGuestMode(false);
      setGuest(false);
      touchLastActive();
    })();
  }, [userId]);

  useEffect(() => {
    setProfile(null);
    void refreshProfile();
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud sign-in is not configured in this build');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    router.replace('/(tabs)');
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string, username?: string) => {
    if (!supabase) throw new Error('Cloud sign-up is not configured in this build');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, ...(username ? { username } : {}) },
        emailRedirectTo: Linking.createURL('/login'),
      },
    });
    if (error) throw error;
    // With email confirmation on, Supabase returns a user but no session yet.
    if (!data.session) return { needsConfirmation: true };
    router.replace('/(tabs)');
    return { needsConfirmation: false };
  }, []);

  const signOut = useCallback(async (opts?: { wipeLocal?: boolean }) => {
    if (opts?.wipeLocal) {
      await wipeLocalData();
      await setLocalOwner(null);
    }
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    lastUser.current = null;
    setProfile(null);
    setOwnerConflict(false);
    router.replace('/login');
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Cloud is not configured in this build');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/login') });
    if (error) throw error;
  }, []);

  const continueAsGuest = useCallback(async () => {
    await setGuestMode(true);
    setGuest(true);
    router.replace('/(tabs)');
  }, []);

  const resolveOwnerConflict = useCallback(
    async (choice: 'wipe' | 'signout') => {
      if (choice === 'wipe' && userId) {
        await wipeLocalData();
        await setLocalOwner(userId);
        setOwnerConflict(false);
        return;
      }
      if (supabase) await supabase.auth.signOut();
      lastUser.current = null;
      setOwnerConflict(false);
      router.replace('/login');
    },
    [userId]
  );

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      offlineMode,
      guest,
      ownerConflict,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      continueAsGuest,
      refreshProfile,
      resolveOwnerConflict,
    }),
    [session, profile, loading, offlineMode, guest, ownerConflict, signIn, signUp, signOut, sendPasswordReset, continueAsGuest, refreshProfile, resolveOwnerConflict]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** True when community features can be used (cloud configured and signed in). */
export function useCanConnect() {
  const { user, offlineMode } = useAuth();
  return !offlineMode && !!user;
}
