import { capitalizeWords } from '../src/lib/names';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Button, Checkbox, HelperText, Text, TextInput } from 'react-native-paper';
import { PRIVACY_URL, TERMS_URL } from '../src/config';
import { useAuth } from '../src/context/AuthContext';
import { normalizeUsername, usernameAvailable } from '../src/social/profiles';
import { useAppTheme } from '../src/theme';
import { EmptyState } from '../src/ui/EmptyState';
import { Notice } from '../src/ui/Notice';
import { useGuestBackupNotice } from '../src/lib/guestJournal';
import { Screen } from '../src/ui/Screen';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  // Opened by "Start a journey" while journaling without an account.
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { colors } = useAppTheme();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  // Accounts are for adults: under-18s would need a parent's verifiable consent (DPDP Act, s. 9).
  const [adult, setAdult] = useState(false);
  const backupNotice = useGuestBackupNotice();

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
    // A slow answer for a name you've since changed must not mark the new name as free.
    let current = true;
    const t = setTimeout(() => {
      usernameAvailable(username)
        .then(ok => current && setUsernameState(ok ? 'ok' : 'taken'))
        .catch(() => current && setUsernameState('idle'));
    }, 400);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [username]);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signUp(email.trim(), password, displayName.trim(), username);
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

  // A username is required: it is how people find and add you to a shared trip.
  const valid = displayName.trim().length >= 2 && /.+@.+\..+/.test(email) && password.length >= 8 && usernameState === 'ok' && adult;

  return (
    <Screen>
      <Text variant="headlineSmall" style={{ fontWeight: '800' }}>
        Create your Wayfare account
      </Text>
      <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 16 }}>
        Free forever for journaling. Your trips stay private unless you choose to share.
      </Text>
      <View style={{ gap: 4 }}>
        <TextInput mode="outlined" label="Your name" value={displayName} onChangeText={t => setDisplayName(capitalizeWords(t))} autoComplete="name" maxLength={60} error={displayName.length > 0 && displayName.trim().length < 2} />
        {displayName.length > 0 && displayName.trim().length < 2 ? <HelperText type="error">At least 2 letters</HelperText> : null}
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
                  : 'Pick a username: people use it to add you to a trip or @mention you'}
        </HelperText>
        <TextInput
          mode="outlined"
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          error={email.length > 3 && !/.+@.+\..+/.test(email)}
        />
        {email.length > 3 && !/.+@.+\..+/.test(email) ? <HelperText type="error">That doesn't look like an email address</HelperText> : null}
        <TextInput
          mode="outlined"
          label="Password (8+ characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          style={{ marginTop: 8 }}
        />
        {password.length > 0 && password.length < 8 ? <HelperText type="error">{8 - password.length} more character{8 - password.length === 1 ? '' : 's'} needed</HelperText> : null}
      </View>
      <Pressable
        onPress={() => setAdult(v => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: adult }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, marginLeft: -8 }}
      >
        <Checkbox.Android status={adult ? 'checked' : 'unchecked'} onPress={() => setAdult(v => !v)} />
        <Text style={{ flex: 1 }}>I am 18 or older</Text>
      </Pressable>
      {reason === 'journey' ? (
        <Notice icon="map-marker-path" text="Journeys need a free account: they back up, and you can plan days, split costs and add your crew. Your diary comes with you." />
      ) : null}
      {backupNotice ? <Notice text={backupNotice} icon="cloud-upload-outline" /> : null}
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
