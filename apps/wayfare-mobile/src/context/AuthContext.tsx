import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../config';
import { claimLocalData, wipeAllData } from '../lib/localDb';
import { deleteLocalFiles } from '../lib/media';
import { haltSync, resumeSync } from '../lib/sync';
import { stopTripTracking } from '../lib/tracking';
import { supabase } from '../lib/supabase';

type Profile = { display_name: string | null; home_region: string | null; tier: string };

export type SignUpOutcome = 'signed_in' | 'confirm_email';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** Supabase isn't configured in this build: the app runs local-only. */
  offlineMode: boolean;
  /** The user chose to use the app without an account. */
  guest: boolean;
  /** Local data has been claimed for the signed-in account; safe to sync. */
  dataReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpOutcome>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const GUEST_KEY = 'wayfare_guest_v1';
export const AUTH_REDIRECT = 'wayfare://auth/callback';

const AuthContext = createContext<AuthContextValue | null>(null);

function friendly(error: { message: string }): Error {
  const m = error.message.toLowerCase();
  if (m.includes('invalid login')) return new Error('Wrong email or password.');
  if (m.includes('email not confirmed')) return new Error('Please confirm your email first — check your inbox.');
  if (m.includes('already registered')) return new Error('An account with this email already exists. Try signing in.');
  if (m.includes('rate limit') || m.includes('too many')) return new Error('Too many attempts. Please wait a minute and try again.');
  if (m.includes('network') || m.includes('fetch')) return new Error('No connection. Check your internet and try again.');
  return new Error(error.message);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);
  const [claimedFor, setClaimedFor] = useState<string | null>(null);
  const offlineMode = !isSupabaseConfigured;
  const userId = session?.user?.id ?? null;
  const claiming = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(GUEST_KEY)
      .then(v => setGuest(v === '1'))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Local data belongs to exactly one account; adopt guest data or wipe a previous user's.
  useEffect(() => {
    if (!userId) {
      setClaimedFor(null);
      claiming.current = null;
      return;
    }
    if (claiming.current === userId) return;
    claiming.current = userId;
    claimLocalData(userId)
      .then(({ discardedUris }) => deleteLocalFiles(discardedUris))
      .catch(() => {})
      .finally(() => setClaimedFor(userId));
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('display_name, home_region, tier').eq('id', userId).maybeSingle();
    if (data) setProfile(data as Profile);
  }, [userId]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud sign-in is not available in this build.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw friendly(error);
    await AsyncStorage.removeItem(GUEST_KEY);
    setGuest(false);
    router.replace('/(tabs)');
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string): Promise<SignUpOutcome> => {
    if (!supabase) throw new Error('Cloud sign-up is not available in this build.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName }, emailRedirectTo: AUTH_REDIRECT },
    });
    if (error) throw friendly(error);
    // With "Confirm email" on, there is no session until the link is opened.
    if (!data.session) return 'confirm_email';
    await AsyncStorage.removeItem(GUEST_KEY);
    setGuest(false);
    router.replace('/(tabs)');
    return 'signed_in';
  }, []);

  /** Wipes this device. Sync is halted first so a late pull cannot repopulate it. */
  const clearLocal = useCallback(async () => {
    await haltSync();
    try {
      await stopTripTracking().catch(() => {});
      deleteLocalFiles(await wipeAllData());
    } finally {
      resumeSync();
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearLocal();
    if (supabase) await supabase.auth.signOut();
    await AsyncStorage.removeItem(GUEST_KEY);
    setGuest(false);
    router.replace('/login');
  }, [clearLocal]);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Password reset is not available in this build.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: AUTH_REDIRECT });
    if (error) throw friendly(error);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error('Not available in this build.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw friendly(error);
  }, []);

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!supabase || !userId) return;
      const { error } = await supabase.from('profiles').update({ display_name: name.trim().slice(0, 60) }).eq('id', userId);
      if (error) throw friendly(error);
      await refreshProfile();
    },
    [userId, refreshProfile]
  );

  const deleteAccount = useCallback(async () => {
    if (!supabase) throw new Error('Not available in this build.');
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw new Error('Could not delete your account. Check your connection and try again.');
    await clearLocal();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    await AsyncStorage.removeItem(GUEST_KEY);
    setGuest(false);
    router.replace('/login');
  }, [clearLocal]);

  const continueAsGuest = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, '1');
    setGuest(true);
    router.replace('/(tabs)');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      offlineMode,
      guest,
      dataReady: !!userId && claimedFor === userId,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      updateDisplayName,
      deleteAccount,
      continueAsGuest,
      refreshProfile,
    }),
    [session, profile, loading, offlineMode, guest, userId, claimedFor, signIn, signUp, signOut, resetPassword, updatePassword, updateDisplayName, deleteAccount, continueAsGuest, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
