import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { wakeServer } from '../src/api/client';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { useNotificationTaps } from '../src/notifications';
import { paperTheme, useTokens } from '../src/design/tokens';

function Screens() {
  const { user } = useAuth();
  const { c } = useTokens();
  useNotificationTaps(!!user);
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '700', color: c.text },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: c.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: '' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[sessionId]" options={{ title: 'Conversation' }} />
      <Stack.Screen name="library" options={{ title: 'Library' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const { dark } = useTokens();
  useEffect(() => { wakeServer(); }, []);
  return (
    <AuthProvider>
      <PaperProvider theme={paperTheme(dark)}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Screens />
      </PaperProvider>
    </AuthProvider>
  );
}
