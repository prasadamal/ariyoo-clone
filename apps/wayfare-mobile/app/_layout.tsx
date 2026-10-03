import { Stack } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { AppLockProvider } from '../src/context/AppLockContext';
import { AuthProvider } from '../src/context/AuthContext';
import { SyncOnForeground } from '../src/context/SyncContext';
import { wayfareTheme } from '../src/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppLockProvider>
      <PaperProvider theme={wayfareTheme}>
        <SyncOnForeground />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: '#fafaf9' } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Sign in' }} />
          <Stack.Screen name="register" options={{ title: 'Join Wayfare' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="trip/new" options={{ title: 'New trip' }} />
          <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
        </Stack>
      </PaperProvider>
      </AppLockProvider>
    </AuthProvider>
  );
}
