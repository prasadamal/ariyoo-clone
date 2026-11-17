import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { wakeServer } from '../src/api/client';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { useNotificationTaps } from '../src/notifications';
import { appTheme } from '../src/theme';

function Screens() {
  const { user } = useAuth();
  useNotificationTaps(!!user);
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#f8fafc', contentStyle: { backgroundColor: '#0f172a' } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Sign in' }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[sessionId]" options={{ title: 'Conversation' }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => { wakeServer(); }, []);
  return (
    <AuthProvider>
      <PaperProvider theme={appTheme}>
        <StatusBar style="light" />
        <Screens />
      </PaperProvider>
    </AuthProvider>
  );
}
