import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';
import { useToast } from '../src/context/ToastContext';
import { sendFeedback } from '../src/lib/telemetry';
import { useAppTheme } from '../src/theme';
import { Screen } from '../src/ui/Screen';

/** Tell us what's broken or what you'd love. Goes straight to the Wayfare team (not public). */
export default function FeedbackScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState(user?.email ?? '');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  // A second tap can't send it twice.
  const busy = useRef(false);

  const send = async () => {
    if (busy.current || !message.trim()) return;
    busy.current = true;
    setSending(true);
    setError('');
    try {
      await sendFeedback(message, contact);
      toast('Thanks! We read every message.');
      router.back();
    } catch (e) {
      // The text stays so nothing is lost.
      setError(e instanceof Error ? e.message : 'Could not send. Try again.');
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  return (
    <Screen>
      <Text style={{ color: colors.muted, lineHeight: 21, marginBottom: 12 }}>
        Found a bug, or wish Wayfare did something? Tell us here. The app version and phone type are added for you.
      </Text>
      <TextInput mode="outlined" label="Your message" value={message} onChangeText={setMessage} multiline numberOfLines={6} maxLength={4000} style={{ minHeight: 140 }} />
      <TextInput mode="outlined" label="Email to reply to (optional)" value={contact} onChangeText={setContact} autoCapitalize="none" keyboardType="email-address" style={{ marginTop: 10 }} maxLength={200} />
      {error ? <HelperText type="error">{error}</HelperText> : null}
      <Button mode="contained" icon="send" onPress={send} loading={sending} disabled={!message.trim() || sending} style={{ marginTop: 14 }}>
        Send feedback
      </Button>
    </Screen>
  );
}
