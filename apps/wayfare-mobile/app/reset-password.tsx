import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { newPasswordProblem, parseAuthRedirect } from '../src/lib/authRedirect';
import { supabase } from '../src/lib/supabase';
import { useAppTheme } from '../src/theme';
import { Notice } from '../src/ui/Notice';
import { Screen } from '../src/ui/Screen';

type Phase = 'checking' | 'ready' | 'invalid' | 'saving' | 'done';

/**
 * Where the "reset your password" email lands. Reads the one-time sign-in from the link, then lets the
 * traveller choose a new password. Expired or already-used links get a clear way to ask for a new one.
 */
export default function ResetPasswordScreen() {
  const { colors } = useAppTheme();
  const url = Linking.useURL();
  const handled = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>('checking');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!supabase) { setPhase('invalid'); setMessage('Password reset needs the cloud, which isn’t available in this build.'); return; }
    if (url === null) {
      // No link yet (useURL is still resolving, or the screen was opened directly).
      const t = setTimeout(() => setPhase(p => (p === 'checking' ? 'invalid' : p)), 2500);
      return () => clearTimeout(t);
    }
    if (handled.current === url) return;
    handled.current = url;
    const link = parseAuthRedirect(url);
    void (async () => {
      try {
        if (link.kind === 'error') { setMessage(link.message); setPhase('invalid'); return; }
        if (link.kind === 'tokens') {
          const { error } = await supabase!.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
          if (error) throw error;
          setPhase('ready');
          return;
        }
        if (link.kind === 'code') {
          const { error } = await supabase!.auth.exchangeCodeForSession(link.code);
          if (error) throw error;
          setPhase('ready');
          return;
        }
        setMessage('Open the reset link from your email on this phone to choose a new password.');
        setPhase('invalid');
      } catch {
        setMessage('This reset link has expired or was already used. Ask for a new one below.');
        setPhase('invalid');
      }
    })();
  }, [url]);

  const problem = newPasswordProblem(password, confirm);

  const save = async () => {
    if (problem || !supabase) return;
    setPhase('saving');
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(/same|different/i.test(error.message) ? 'Choose a password you haven’t used for this account.' : 'Couldn’t save the new password. Check your connection and try again.');
      setPhase('ready');
      return;
    }
    setPhase('done');
  };

  if (phase === 'checking') {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.muted }}>Checking your reset link…</Text>
        </View>
      </Screen>
    );
  }

  if (phase === 'invalid') {
    return (
      <Screen>
        <Notice tone="error" text={message || 'This reset link didn’t work. Ask for a new one below.'} />
        <Button mode="contained" style={{ marginTop: 16 }} onPress={() => router.replace('/forgot-password')}>
          Send a new reset link
        </Button>
        <Button style={{ marginTop: 8 }} onPress={() => router.replace('/login')}>Back to sign in</Button>
      </Screen>
    );
  }

  if (phase === 'done') {
    return (
      <Screen>
        <Notice tone="success" text="Your password has been changed. You’re signed in." />
        <Button mode="contained" style={{ marginTop: 16 }} onPress={() => router.replace('/(tabs)')}>
          Go to my journeys
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={{ color: colors.muted, marginBottom: 16, lineHeight: 21 }}>Choose a new password for your Wayfare account.</Text>
      <TextInput
        mode="outlined"
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        autoComplete="password-new"
        right={<TextInput.Icon icon={show ? 'eye-off' : 'eye'} onPress={() => setShow(s => !s)} accessibilityLabel={show ? 'Hide password' : 'Show password'} />}
      />
      <TextInput
        mode="outlined"
        label="Type it again"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry={!show}
        autoComplete="password-new"
        style={{ marginTop: 10 }}
      />
      {password.length > 0 && problem ? <HelperText type="error">{problem}</HelperText> : null}
      {message ? <Notice tone="error" text={message} /> : null}
      <Button mode="contained" style={{ marginTop: 16 }} onPress={save} loading={phase === 'saving'} disabled={Boolean(problem) || phase === 'saving'}>
        Save new password
      </Button>
    </Screen>
  );
}
