import { Stack } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { AppLockProvider } from '../src/context/AppLockContext';
import { AuthProvider } from '../src/context/AuthContext';
import { SyncOnForeground } from '../src/context/SyncContext';
import { ThemeProvider, useWayfareTheme } from '../src/context/ThemeContext';

function Navigation() {
  const { paperTheme, isDark } = useWayfareTheme();
  return (
    <PaperProvider theme={paperTheme}>
      <SyncOnForeground />
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trip/new" options={{ title: 'New trip' }} />
        <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
        <Stack.Screen name="share/[shareId]" options={{ title: 'Shared journey' }} />
      </Stack>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppLockProvider>
          <Navigation />
        </AppLockProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
