import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Button, Provider as PaperProvider, Text } from 'react-native-paper';
import { AppLockProvider } from '../src/context/AppLockContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { SyncProvider } from '../src/context/SyncContext';
import { ThemeProvider, useWayfareTheme } from '../src/context/ThemeContext';
// Registers the background location task at startup (the OS may launch the app headlessly).
import '../src/lib/tracking';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Shown by Expo Router if a screen throws, instead of a white screen. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text variant="titleLarge">Something went wrong</Text>
      <Text style={{ marginVertical: 12, textAlign: 'center', opacity: 0.7 }}>
        Your journal is safe on this device. {__DEV__ ? error.message : 'Please try again.'}
      </Text>
      <Button mode="contained" onPress={retry}>Try again</Button>
    </View>
  );
}

function Navigation() {
  const { paperTheme } = useWayfareTheme();
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: paperTheme.colors.surface },
        headerTintColor: paperTheme.colors.onSurface,
        contentStyle: { backgroundColor: paperTheme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Sign in' }} />
      <Stack.Screen name="register" options={{ title: 'Join Wayfare' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="trip/new" options={{ title: 'New trip' }} />
      <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
      <Stack.Screen name="share/[shareId]" options={{ title: 'Shared journey' }} />
    </Stack>
  );
}

function Themed() {
  const { paperTheme, isDark } = useWayfareTheme();
  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthProvider>
        <SyncProvider>
          <AppLockProvider>
            <Navigation />
          </AppLockProvider>
        </SyncProvider>
      </AuthProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Themed />
    </ThemeProvider>
  );
}
