import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../config';
import { stopDeviceActivity, stopLocalDeviceActivity } from '../lib/deviceActivity';
import { withJournalLock } from '../lib/journalGate';
import { resolveJournalOwnership } from '../lib/ownership';
import { countTrips } from '../lib/localDb';
import { wipeDevice } from '../lib/wipeDevice';
import { isGuestMode, setGuestMode } from '../lib/session';
import { supabase } from '../lib/supabase';
import { getLocalOwner, setLocalOwner } from '../lib/sync';
import { fetchMyProfile, touchLastActive } from '../social/profiles';
import type { MyProfile } from '../social/types';
import { SOCIAL_ENABLED } from '../lib/features';

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
  journalReady: boolean;
  journalError: string | null;
  retryJournal: () => void;
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
  const [guestLoading, setGuestLoading] = useState(true);
  const [ownership, setOwnership] = useState<{ userId: string | null; phase: 'checking' | 'ready' | 'conflict' | 'error'; error?: string }>({ userId: null, phase: 'checking' });
  const [ownershipAttempt, setOwnershipAttempt] = useState(0);
  const retryJournal = useCallback(() => setOwnershipAttempt(value => value + 1), []);
  const offlineMode = !isSupabaseConfigured;
  const userId = session?.user?.id ?? null;
  const accountEpoch = useRef(0);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const journalReady = !userId || (ownership.userId === userId && ownership.phase === 'ready');
  const ownerConflict = !!userId && ownership.userId === userId && ownership.phase === 'conflict';
  const journalError = ownership.userId === userId && ownership.phase === 'error' ? ownership.error ?? 'Could not open this journal.' : null;

  const refreshProfile = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const epoch = accountEpoch.current;
    try {
      const next = await fetchMyProfile(userId);
      if (currentUser.current === userId && accountEpoch.current === epoch) setProfile(next);
    } catch {
      // keep the last known profile when offline
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    let authChanged = false;
    void isGuestMode().then(value => { if (active) setGuest(value); }).catch(() => undefined).finally(() => { if (active) setGuestLoading(false); });
    if (!supabase) { setLoading(false); return () => { active = false; }; }
    const applySession = (next: Session | null) => {
      if (!active) return;
      if (currentUser.current !== (next?.user.id ?? null)) ++accountEpoch.current;
      currentUser.current = next?.user.id ?? null;
      setSession(next);
      setLoading(false);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      authChanged = true;
      applySession(next);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authChanged) return;
      if (error) { setLoading(false); return; }
      applySession(data.session);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // Resolve ownership before mounting journal screens or starting automatic replication.
  useEffect(() => {
    let active = true;
    if (!userId) { setOwnership({ userId: null, phase: 'ready' }); return; }
    const epoch = accountEpoch.current;
    const current = () => active && currentUser.current === userId && accountEpoch.current === epoch;
    setOwnership({ userId, phase: 'checking' });
    void withJournalLock(async () => {
      const outcome = await resolveJournalOwnership(userId, current, {
        owner: getLocalOwner, count: countTrips, adopt: setLocalOwner,
      });
      if (!current() || outcome === 'stale') return;
      if (outcome === 'ready') {
        await setGuestMode(false);
        if (!current()) return;
        setGuest(false);
        void touchLastActive().catch(() => undefined);
      }
      setOwnership({ userId, phase: outcome });
    }).catch(() => {
      if (current()) setOwnership({ userId, phase: 'error', error: 'Could not open this device’s journal. Retry before syncing.' });
    });
    return () => { active = false; };
  }, [userId, ownershipAttempt]);

  useEffect(() => {
    setProfile(null);
    void refreshProfile();
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud sign-in is not configured in this build');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // No navigation here: the new account rebuilds the screen stack once, and AuthRouteGuard
    // (app/_layout.tsx) moves on to Journeys after that settles. Navigating while the stack is
    // being rebuilt crashed the app on Android.
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string, username?: string) => {
    if (!supabase) throw new Error('Cloud sign-up is not configured in this build');
    // Accounts are created already confirmed (no email to wait for), then signed in right away.
    // If that service isn't reachable, fall back to the normal Supabase sign-up.
    let created = false;
    if (username) {
      try {
        const { data: made, error: fnError } = await supabase.functions.invoke('signup', {
          body: { email, password, display_name: displayName, username },
        });
        if (fnError) {
          // A refusal carries the reason ("username taken", "already exists"): show it.
          const ctx = (fnError as { context?: Response }).context;
          const body = ctx ? await ctx.json().catch(() => null) : null;
          if (body?.error) throw new Error(body.error);
        } else if (made?.ok) created = true;
      } catch (e) {
        if (e instanceof Error && !/fetch|network|function/i.test(e.message)) throw e;
      }
    }
    if (created) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { needsConfirmation: false }; // AuthRouteGuard opens Journeys
    }
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
    // AuthRouteGuard opens Journeys once the new account's screens are ready.
    return { needsConfirmation: false };
  }, []);

  const signOut = useCallback(async (opts?: { wipeLocal?: boolean }) => {
    await stopDeviceActivity();
    if (opts?.wipeLocal) {
      await wipeDevice();
      await setLocalOwner(null);
    }
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setOwnership({ userId: null, phase: 'ready' });
    setProfile(null);
    retryJournal();
    // AuthRouteGuard returns to sign-in after the screens are rebuilt for "no account".
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Cloud is not configured in this build');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/reset-password') });
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
        await stopDeviceActivity();
        if (currentUser.current !== userId) throw new Error('Account changed. Retry with the current account.');
        await wipeDevice();
        await setLocalOwner(userId);
        retryJournal();
        return;
      }
      await stopLocalDeviceActivity();
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      setOwnership({ userId: null, phase: 'ready' });
      setProfile(null);
      // AuthRouteGuard returns to sign-in.
    },
    [userId, retryJournal]
  );

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading: loading || guestLoading,
      offlineMode,
      guest,
      ownerConflict,
      journalReady,
      journalError,
      retryJournal,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      continueAsGuest,
      refreshProfile,
      resolveOwnerConflict,
    }),
    [session, profile, loading, guestLoading, offlineMode, guest, ownerConflict, journalReady, journalError, retryJournal, signIn, signUp, signOut, sendPasswordReset, continueAsGuest, refreshProfile, resolveOwnerConflict]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** True when community features can be used (cloud configured and signed in). */
/** Signed in AND social features switched on (src/lib/features.ts): feed, travellers, chat, follows. */
export function useSocial() {
  return useCanConnect() && SOCIAL_ENABLED;
}

export function useCanConnect() {
  const { user, offlineMode, journalReady, ownerConflict } = useAuth();
  return !offlineMode && !!user && journalReady && !ownerConflict;
}
