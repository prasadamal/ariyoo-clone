import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { PRIVACY_URL, TERMS_URL } from '../src/config';
import { useAuth } from '../src/context/AuthContext';
import { normalizeUsername, usernameAvailable } from '../src/social/profiles';
import { useAppTheme } from '../src/theme';
import { EmptyState } from '../src/ui/EmptyState';
import { Notice } from '../src/ui/Notice';
import { Screen } from '../src/ui/Screen';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const { colors } = useAppTheme();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setUsernameState('idle');
      return;
    }
    if (!/^[a-z0-9_.]{3,24}$/.test(username)) {
      setUsernameState('invalid');
      return;
    }
    setUsernameState('checking');
    const t = setTimeout(() => {
      usernameAvailable(username)
        .then(ok => setUsernameState(ok ? 'ok' : 'taken'))
        .catch(() => setUsernameState('idle'));
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signUp(email.trim(), password, displayName.trim(), username || undefined);
      if (result.needsConfirmation) setConfirmEmail(email.trim());
    } catch (e: unknown) {
      setError((e as Error).message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (confirmEmail) {
    return (
      <Screen>
        <EmptyState
          icon="email-check-outline"
          title="Check your inbox"
          body={`We sent a confirmation link to ${confirmEmail}. Open it on this phone, then sign in.`}
        />
        <Link href="/login" asChild>
          <Button mode="contained">Go to sign in</Button>
        </Link>
      </Screen>
    );
  }

  const valid = displayName.trim().length >= 2 && /.+@.+\..+/.test(email) && password.length >= 8 && usernameState !== 'taken' && usernameState !== 'invalid';

  return (
    <Screen>
      <Text variant="headlineSmall" style={{ fontWeight: '800' }}>
        Join the travellers
      </Text>
      <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 16 }}>
        Free forever for journaling. Your trips stay private unless you choose to share.
      </Text>
      <View style={{ gap: 4 }}>
        <TextInput mode="outlined" label="Your name" value={displayName} onChangeText={setDisplayName} autoComplete="name" maxLength={60} />
        <TextInput
          mode="outlined"
          label="Username"
          value={username}
          onChangeText={t => setUsername(normalizeUsername(t))}
          autoCapitalize="none"
          left={<TextInput.Affix text="@" />}
          style={{ marginTop: 8 }}
        />
        <HelperText type={usernameState === 'taken' || usernameState === 'invalid' ? 'error' : 'info'} visible>
          {usernameState === 'taken'
            ? 'That username is taken'
            : usernameState === 'invalid'
              ? '3–24 characters: letters, numbers, dots, underscores'
              : usernameState === 'ok'
                ? '✓ Available'
                : usernameState === 'checking'
                  ? 'Checking…'
                  : 'Optional — we will pick one you can change later'}
        </HelperText>
        <TextInput
          mode="outlined"
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          mode="outlined"
          label="Password (8+ characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          style={{ marginTop: 8 }}
        />
      </View>
      {error ? <Notice tone="error" text={error} /> : null}
      <Button mode="contained" onPress={submit} loading={loading} disabled={!valid || loading} style={{ marginTop: 16 }}>
        Create account
      </Button>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12, lineHeight: 18 }}>
        By creating an account you agree to the{' '}
        <Text style={{ color: colors.primary }} onPress={() => Linking.openURL(TERMS_URL)}>
          Terms of Use
        </Text>{' '}
        (including our zero-tolerance policy for objectionable content) and the{' '}
        <Text style={{ color: colors.primary }} onPress={() => Linking.openURL(PRIVACY_URL)}>
          Privacy Policy
        </Text>
        .
      </Text>
      <Link href="/login" asChild>
        <Button style={{ marginTop: 12 }}>I already have an account</Button>
      </Link>
    </Screen>
  );
}
