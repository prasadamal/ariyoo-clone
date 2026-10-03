import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { AuthLayout } from '../src/components/AuthLayout';
import { StatusBanner } from '../src/components/StatusBanner';
import { useAuth } from '../src/context/AuthContext';
import { validatePassword } from '../src/lib/validation';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const problem = validatePassword(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('The two passwords do not match.');
    setLoading(true);
    setError('');
    try {
      await updatePassword(password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Stack.Screen options={{ title: 'New password' }} />
      {!session ? (
        <>
          <Text variant="headlineSmall">Link expired</Text>
          <Text style={{ marginVertical: 12, color: theme.colors.onSurfaceVariant }}>Request a new reset link and open it on this phone.</Text>
          <Button mode="contained" onPress={() => router.replace('/forgot-password')}>Request a new link</Button>
        </>
      ) : (
        <>
          <Text variant="headlineSmall" style={{ marginBottom: 16 }}>Choose a new password</Text>
          {error ? <StatusBanner kind="error">{error}</StatusBanner> : null}
          <TextInput label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" mode="outlined" style={{ marginBottom: 12 }} />
          <TextInput label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" mode="outlined" style={{ marginBottom: 12 }} onSubmitEditing={submit} />
          <Button mode="contained" onPress={submit} loading={loading} disabled={loading}>Update password</Button>
        </>
      )}
    </AuthLayout>
  );
}
