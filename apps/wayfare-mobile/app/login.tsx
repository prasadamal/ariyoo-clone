import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { AuthLayout } from '../src/components/AuthLayout';
import { StatusBanner } from '../src/components/StatusBanner';
import { useAuth } from '../src/context/AuthContext';
import { validateEmail } from '../src/lib/validation';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn, offlineMode, continueAsGuest, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (offlineMode) {
    return (
      <AuthLayout>
        <Text variant="headlineSmall">Offline journal</Text>
        <Text style={{ marginVertical: 12, color: theme.colors.onSurfaceVariant }}>
          Cloud sync is not available in this build. Your journal is saved on this device.
        </Text>
        <Button mode="contained" onPress={() => router.replace('/(tabs)')}>Continue</Button>
      </AuthLayout>
    );
  }

  const submit = async () => {
    if (!validateEmail(email)) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Text variant="headlineMedium">Your journey, journaled</Text>
      <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 24 }}>Sign in to back up and sync your trips.</Text>
      {error ? <StatusBanner kind="error">{error}</StatusBanner> : null}
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" mode="outlined" style={{ marginBottom: 12 }} />
      <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" mode="outlined" style={{ marginBottom: 8 }} onSubmitEditing={submit} />
      <Link href="/forgot-password" asChild>
        <Button compact style={{ alignSelf: 'flex-end', marginBottom: 8 }}>Forgot password?</Button>
      </Link>
      <Button mode="contained" onPress={submit} loading={loading} disabled={loading}>Sign in</Button>
      <Link href="/register" asChild>
        <Button style={{ marginTop: 12 }}>Create account</Button>
      </Link>
      {!user ? (
        <Button mode="text" style={{ marginTop: 4 }} onPress={continueAsGuest}>Continue without an account</Button>
      ) : null}
    </AuthLayout>
  );
}
