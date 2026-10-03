import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { AuthLayout } from '../src/components/AuthLayout';
import { StatusBanner } from '../src/components/StatusBanner';
import { useAuth } from '../src/context/AuthContext';
import { validateEmail } from '../src/lib/validation';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!validateEmail(email)) return setError('Enter a valid email address.');
    setLoading(true);
    setError('');
    try {
      await resetPassword(email.trim());
      setSent(true); // same message whether or not the account exists
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Stack.Screen options={{ title: 'Reset password' }} />
      {sent ? (
        <>
          <Text variant="headlineSmall">Check your inbox</Text>
          <Text style={{ marginVertical: 12, color: theme.colors.onSurfaceVariant, lineHeight: 22 }}>
            If an account exists for {email.trim()}, we sent a link to choose a new password. Open it on this phone.
          </Text>
          <Button mode="contained" onPress={() => router.replace('/login')}>Back to sign in</Button>
        </>
      ) : (
        <>
          <Text variant="headlineSmall" style={{ marginBottom: 8 }}>Forgot your password?</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>Enter your email and we will send you a reset link.</Text>
          {error ? <StatusBanner kind="error">{error}</StatusBanner> : null}
          <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" mode="outlined" style={{ marginBottom: 12 }} onSubmitEditing={submit} />
          <Button mode="contained" onPress={submit} loading={loading} disabled={loading}>Send reset link</Button>
        </>
      )}
    </AuthLayout>
  );
}
