// Registers the background location task as early as possible (background relaunches need it).
import '../src/lib/locationTask';
import { Stack, DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Button, Dialog, Provider as PaperProvider, Portal, Text } from 'react-native-paper';
import { AppLockProvider } from '../src/context/AppLockContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { InboxProvider } from '../src/context/InboxContext';
import { SyncProvider } from '../src/context/SyncContext';
import { ThemeProvider, useWayfareTheme } from '../src/context/ThemeContext';
import { ToastProvider } from '../src/context/ToastContext';
import { refreshPushRegistration, useNotificationRouting } from '../src/lib/notifications';

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
    <Stack key={`${user?.id ?? 'guest'}:${journalReady}`}
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
      <Stack.Screen name="journal" options={{ title: 'Journal' }} />
      <Stack.Screen name="safety" options={{ title: 'Safety' }} />
      <Stack.Screen name="live/[id]" options={{ title: 'Live location' }} />
      <Stack.Screen name="wrapped" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="badges" options={{ title: 'Badges & tiers' }} />
      <Stack.Screen name="tools/currency" options={{ title: 'Currency converter' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
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
                  <StatusBar style={isDark ? 'light' : 'dark'} />
                  <PushRegistrar />
                  <RootStack />
                  <OwnerConflictDialog />
                </AppLockProvider>
              </InboxProvider>
            </SyncProvider>
          </AuthProvider>
        </ToastProvider>
      </NavigationThemeProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}
