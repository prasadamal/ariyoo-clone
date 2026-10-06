import { useState } from 'react';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/theme';
import { Notice } from '../src/ui/Notice';
import { Screen } from '../src/ui/Screen';

export default function ForgotPasswordScreen() {
  const { sendPasswordReset } = useAuth();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async () => {
    setState('sending');
    try {
      await sendPasswordReset(email.trim());
      setState('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send reset email');
      setState('error');
    }
  };

  return (
    <Screen>
      <Text style={{ color: colors.muted, marginBottom: 16, lineHeight: 21 }}>
        Enter the email you signed up with and we will send you a link to set a new password.
      </Text>
      <TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {state === 'sent' ? <Notice tone="success" text="Reset link sent. Check your inbox (and spam folder)." /> : null}
      {state === 'error' ? <Notice tone="error" text={error} /> : null}
      <Button mode="contained" style={{ marginTop: 16 }} onPress={submit} loading={state === 'sending'} disabled={!/.+@.+\..+/.test(email) || state === 'sending'}>
        Send reset link
      </Button>
    </Screen>
  );
}
