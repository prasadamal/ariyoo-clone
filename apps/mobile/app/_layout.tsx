import { Stack } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { appTheme } from '../src/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PaperProvider theme={appTheme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#f8fafc' }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Sign in' }} />
          <Stack.Screen name="register" options={{ title: 'Create account' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[sessionId]" options={{ title: 'Conversation' }} />
        </Stack>
      </PaperProvider>
    </AuthProvider>
  );
}
