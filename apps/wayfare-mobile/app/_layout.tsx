import { Stack } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { wayfareTheme } from '../src/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PaperProvider theme={wayfareTheme}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: '#fafaf9' } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Sign in' }} />
          <Stack.Screen name="register" options={{ title: 'Join Wayfare' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="trip/new" options={{ title: 'New trip' }} />
          <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
        </Stack>
      </PaperProvider>
    </AuthProvider>
  );
}
