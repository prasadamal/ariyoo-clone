import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { AuthLayout } from '../src/components/AuthLayout';
import { StatusBanner } from '../src/components/StatusBanner';
import { PRIVACY_URL } from '../src/config';
import { useAuth } from '../src/context/AuthContext';
import { LIMITS, validateEmail, validatePassword } from '../src/lib/validation';

export default function RegisterScreen() {
  const theme = useTheme();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const submit = async () => {
    if (!displayName.trim()) return setError('Enter a display name.');
    if (!validateEmail(email)) return setError('Enter a valid email address.');
    const pw = validatePassword(password);
    if (pw) return setError(pw);
    setLoading(true);
    setError('');
    try {
      const outcome = await signUp(email.trim(), password, displayName.trim());
      if (outcome === 'confirm_email') setConfirmSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <AuthLayout>
        <Text variant="headlineSmall">Check your inbox</Text>
        <Text style={{ marginVertical: 12, color: theme.colors.onSurfaceVariant, lineHeight: 22 }}>
          We sent a confirmation link to {email.trim()}. Open it on this phone to finish creating your account, then come back and sign in.
        </Text>
        <Link href="/login" asChild>
          <Button mode="contained">Go to sign in</Button>
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Text variant="headlineMedium" style={{ marginBottom: 16 }}>Join Wayfare</Text>
      {error ? <StatusBanner kind="error">{error}</StatusBanner> : null}
      <TextInput label="Display name" value={displayName} onChangeText={setDisplayName} autoComplete="name" textContentType="name" mode="outlined" maxLength={LIMITS.displayName} style={{ marginBottom: 12 }} />
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" mode="outlined" style={{ marginBottom: 12 }} />
      <TextInput label="Password (8+ characters, letters and numbers)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" mode="outlined" style={{ marginBottom: 12 }} onSubmitEditing={submit} />
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
        By creating an account you agree to our <Text variant="bodySmall" style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>.
      </Text>
      <Button mode="contained" onPress={submit} loading={loading} disabled={loading}>Create account</Button>
      <Link href="/login" asChild>
        <Button style={{ marginTop: 12 }}>Back to sign in</Button>
      </Link>
    </AuthLayout>
  );
}
