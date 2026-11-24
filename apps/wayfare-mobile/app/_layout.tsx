// Registers the background location task as early as possible (background relaunches need it).
import '../src/lib/locationTask';
import { flushTelemetry, installGlobalErrorReporting, reportError, track } from '../src/lib/telemetry';

// Errors nobody caught are reported (scrubbed, opt-out in Settings) before the app handles them.
installGlobalErrorReporting();
import { Stack, DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Button, Dialog, Provider as PaperProvider, Portal, Text } from 'react-native-paper';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AppLockProvider } from '../src/context/AppLockContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { InboxProvider } from '../src/context/InboxContext';
import { SyncProvider } from '../src/context/SyncContext';
import { ThemeProvider, useWayfareTheme } from '../src/context/ThemeContext';
import { ToastProvider } from '../src/context/ToastContext';
import { refreshPushRegistration, useNotificationRouting } from '../src/lib/notifications';
import { isHiddenSocialRoute } from '../src/lib/features';

// Social screens are switched off (src/lib/features.ts): an old link, notification or deep link to one
// lands on Journeys instead of a screen that shouldn't be reachable.
function SocialRouteGuard() {
  const segments = useSegments();
  const hidden = isHiddenSocialRoute(segments);
  useEffect(() => {
    if (hidden) router.replace('/(tabs)');
  }, [hidden]);
  return null;
}

/**
 * Moves between sign-in and Journeys when the account changes, only after the screens for the
 * new account are mounted. (Navigating from inside signIn/signOut raced the stack being rebuilt
 * for the new account, which closed the app on Android.)
 */
function AuthRouteGuard() {
  const { user, loading, journalReady, guest, offlineMode } = useAuth();
  const segments = useSegments();
  const first = (segments[0] as string | undefined) ?? '';
  useEffect(() => {
    if (loading || !journalReady) return;
    const t = setTimeout(() => {
      if (user && (first === 'login' || first === 'register')) router.replace('/(tabs)');
      else if (!user && !guest && !offlineMode && (first === '(tabs)' || first === 'settings')) router.replace('/login');
    }, 0); // after this render's screen changes have committed
    return () => clearTimeout(t);
  }, [user?.id, loading, journalReady, guest, offlineMode, first]);
  return null;
}

function OwnerConflictDialog() {
  const { ownerConflict, resolveOwnerConflict } = useAuth();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolve = async (choice: 'wipe' | 'signout') => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try { await resolveOwnerConflict(choice); }
    catch { setError('Could not complete this action. Your journals have not been assigned to this account. Retry.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return (
    <Portal>
      <Dialog visible={ownerConflict} dismissable={false}>
        <Dialog.Title>Journals from another account</Dialog.Title>
        <Dialog.Content>
          <Text style={{ lineHeight: 21 }}>
            This device holds trips that belong to a different Wayfare account, so they will not be synced to this one.
            You can start fresh here after protecting any unsynced work, or sign out. Signing out stops this device’s recording; sign back into the original account to end any live link it owns.
          </Text>
          {error ? <Text accessibilityRole="alert">{error}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button disabled={busy} onPress={() => { void resolve('signout'); }}>Sign out</Button>
          <Button mode="contained" disabled={busy} loading={busy} onPress={() => { void resolve('wipe'); }}>
            Start fresh here
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

/** Counts that the app was opened today (once a day) and sends waiting reports when it comes back. */
function UsageTracker() {
  useEffect(() => {
    void track('app_open');
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void track('app_open');
        void flushTelemetry();
      }
    });
    return () => sub.remove();
  }, []);
  return null;
}

function PushRegistrar() {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.id) refreshPushRegistration();
  }, [user?.id]);
  return null;
}

function RootStack() {
  const { user, loading, journalReady, ownerConflict, journalError, retryJournal, signOut } = useAuth();
  const [exitError, setExitError] = useState<string | null>(null);
  const { paperTheme } = useWayfareTheme();
  const c = paperTheme.colors;
  useNotificationRouting();
  const blocked = loading || !journalReady;
  return (
    <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} pointerEvents={blocked ? 'none' : 'auto'} accessibilityElementsHidden={blocked} importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}>
    <SocialRouteGuard />
    <AuthRouteGuard />
    {/* Rebuilt once per account (not again when the journal check finishes): two rebuilds in a row
        during sign-in crashed the native screens on Android. The cover below hides the screens
        until this phone's journal is confirmed for the account. */}
    <Stack key={user?.id ?? 'guest'}
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.onSurface,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.background },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Sign in' }} />
      <Stack.Screen name="register" options={{ title: 'Join Wayfare' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
      <Stack.Screen name="feedback" options={{ title: 'Send feedback' }} />
      <Stack.Screen name="find" options={{ title: 'Search' }} />
      <Stack.Screen name="invite/[token]" options={{ title: 'Journey invite' }} />
      <Stack.Screen name="trip/recap/[id]" options={{ title: 'Journey recap', presentation: 'modal' }} />
      <Stack.Screen name="guidelines" options={{ title: 'Community guidelines', presentation: 'modal' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="trip/new" options={{ title: 'New journey', presentation: 'modal' }} />
      <Stack.Screen name="trip/[id]" options={{ title: 'Journey' }} />
      <Stack.Screen name="trip/edit/[id]" options={{ title: 'Edit journey', presentation: 'modal' }} />
      <Stack.Screen name="entry/[id]" options={{ title: 'Edit moment', presentation: 'modal' }} />
      <Stack.Screen name="share/[shareId]" options={{ title: 'Shared journey' }} />
      <Stack.Screen name="post/new" options={{ title: 'New post', presentation: 'modal' }} />
      <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
      <Stack.Screen name="user/[id]" options={{ title: '' }} />
      <Stack.Screen name="profile/edit" options={{ title: 'Edit profile', presentation: 'modal' }} />
      <Stack.Screen name="follows/[id]" options={{ title: 'Travellers' }} />
      <Stack.Screen name="search" options={{ title: 'Find travellers' }} />
      <Stack.Screen name="chat/[id]" options={{ title: '' }} />
      <Stack.Screen name="join/[code]" options={{ title: 'Join crew' }} />
      <Stack.Screen name="board/new" options={{ title: 'Post to the board', presentation: 'modal' }} />
      <Stack.Screen name="board/[id]" options={{ title: 'Board' }} />
      <Stack.Screen name="place/[key]" options={{ title: '' }} />
      <Stack.Screen name="safety" options={{ title: 'Safety' }} />
      <Stack.Screen name="live/[id]" options={{ title: 'Live location' }} />
      <Stack.Screen name="wrapped" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="badges" options={{ title: 'Badges & tiers' }} />
      <Stack.Screen name="tools/currency" options={{ title: 'Currency converter' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="trips/[status]" options={{ title: 'Journeys' }} />
      <Stack.Screen name="passport" options={{ title: 'Passport' }} />
      <Stack.Screen name="blocked" options={{ title: 'Blocked travellers' }} />
    </Stack>
    </View>
    {blocked ? <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: c.background }}>
      {journalError ? <>
        <Text accessibilityRole="alert">{journalError}</Text>
        <Button onPress={retryJournal}>Retry</Button>
        <Button onPress={() => { void signOut().catch(() => setExitError('Could not sign out. Retry when connected.')); }}>Sign out</Button>
        {exitError ? <Text accessibilityRole="alert">{exitError}</Text> : null}
      </> : ownerConflict ? <Text>Choose how to handle this device’s journal.</Text> : <ActivityIndicator />}
    </View> : null}
    </View>
  );
}

function ThemedRoot() {
  const { paperTheme, isDark } = useWayfareTheme();
  const c = paperTheme.colors;
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.primary,
        background: c.background,
        card: c.background,
        text: c.onSurface,
        border: c.border,
        notification: c.primary,
      },
    };
  }, [isDark, c]);
  return (
    <PaperProvider theme={paperTheme}>
      <NavigationThemeProvider value={navTheme}>
        <ToastProvider>
          <AuthProvider>
            <SyncProvider>
              <InboxProvider>
                <AppLockProvider>
                  {/* Swipe-up sheets render here, inside the theme and toast providers they use. */}
                  <BottomSheetModalProvider>
                    <StatusBar style={isDark ? 'light' : 'dark'} />
                    <PushRegistrar />
                    <UsageTracker />
                    <RootStack />
                    <OwnerConflictDialog />
                  </BottomSheetModalProvider>
                </AppLockProvider>
              </InboxProvider>
            </SyncProvider>
          </AuthProvider>
        </ToastProvider>
      </NavigationThemeProvider>
    </PaperProvider>
  );
}

/**
 * If any screen throws while rendering, show a calm retry page instead of closing the app.
 * (expo-router calls this for errors under the root layout.)
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    void reportError(error, 'screen');
  }, [error]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#ffffff' }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#1c1917', textAlign: 'center' }}>Something went wrong</Text>
      <Text style={{ color: '#6b6b72', textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
        Your journals are safe on this phone. Try again, and if it keeps happening, restart the app.
      </Text>
      <Text style={{ color: '#a1a1aa', fontSize: 11, marginTop: 10, textAlign: 'center' }} numberOfLines={3}>
        {error?.message}
      </Text>
      <Button mode="contained" onPress={() => { void retry(); }} style={{ marginTop: 16 }} buttonColor="#6a01a3">
        Try again
      </Button>
    </View>
  );
}

export default function RootLayout() {
  return (
    // Gestures (swipe-up sheets) and the keyboard tracker wrap the whole app.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ThemeProvider>
          <ThemedRoot />
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
