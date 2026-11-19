import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Button, Checkbox, TextInput } from 'react-native-paper';
import { errorMessage } from '../src/api/client';
import { PRIVACY_URL, TERMS_URL } from '../src/config';
import { useAuth } from '../src/context/AuthContext';
import { radius, space, type, useTokens } from '../src/design/tokens';
import { Notice, PageHeader } from '../src/design/ui';
import { emailProblem, MIN_PASSWORD, passwordProblem } from '../src/lib/validation';

const open = (url: string) => Linking.openURL(url).catch(() => undefined);

export default function Register() {
  const { signUp } = useAuth();
  const { c } = useTokens();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [flname, setFlname] = useState('');
  const [isSolver, setIsSolver] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const longEnough = password.length >= MIN_PASSWORD;

  const submit = async () => {
    if (loading) return;
    const problem = emailProblem(email) ?? passwordProblem(password);
    if (problem) return setError(problem);
    if (!accepted) return setError('Please accept the Terms of Use and Privacy Policy.');
    try {
      setLoading(true);
      setError('');
      await signUp({ email: email.trim(), password, flname: flname.trim(), isSeeker: true, isSolver, acceptedTerms: true });
    } catch (e: unknown) {
      setError(errorMessage(e, 'Could not create the account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const choice = (selected: boolean, title: string, body: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}
      style={({ pressed }) => ({ flex: 1, borderRadius: radius.md, borderWidth: selected ? 2 : 1, borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : c.surface, padding: space.md, opacity: pressed ? 0.85 : 1 })}>
      <RNText style={[type.bodyStrong, { color: selected ? c.onAccentSoft : c.text }]}>{title}</RNText>
      <RNText style={[type.small, { color: selected ? c.onAccentSoft : c.textMuted, marginTop: 2 }]}>{body}</RNText>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.sm }} keyboardShouldPersistTaps="handled">
        <PageHeader title="Join Ariyoo" subtitle="Ask about places you are going, or help with places you know." />
        <RNText style={[type.caption, { color: c.textFaint, textTransform: 'uppercase', marginBottom: space.sm }]}>I am here to</RNText>
        <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.xl }}>
          {choice(!isSolver, 'Ask', 'Get answers from locals', () => setIsSolver(false))}
          {choice(isSolver, 'Ask and answer', 'Also help as an expert', () => setIsSolver(true))}
        </View>
        <TextInput mode="outlined" label="Full name" value={flname} onChangeText={setFlname} autoComplete="name" textContentType="name" maxLength={100} returnKeyType="next" style={{ marginBottom: space.md, backgroundColor: c.surface }} />
        <TextInput
          mode="outlined"
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          returnKeyType="next"
          style={{ marginBottom: space.md, backgroundColor: c.surface }}
        />
        <TextInput
          mode="outlined"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoComplete="new-password"
          textContentType="newPassword"
          right={<TextInput.Icon icon={show ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShow(s => !s)} accessibilityLabel={show ? 'Hide password' : 'Show password'} />}
          style={{ marginBottom: space.xs, backgroundColor: c.surface }}
        />
        <RNText style={[type.small, { color: longEnough ? c.success : c.textMuted, marginBottom: space.lg }]}>
          {longEnough ? '✓ Strong enough' : `At least ${MIN_PASSWORD} characters. A short sentence works well.`}
        </RNText>
        <Pressable onPress={() => setAccepted(a => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}
          style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.lg, gap: space.xs }}>
          <Checkbox.Android status={accepted ? 'checked' : 'unchecked'} onPress={() => setAccepted(a => !a)} />
          <RNText style={[type.small, { flex: 1, color: c.textMuted, paddingTop: 8 }]}>
            I am 18 or older and agree to the{' '}
            <RNText style={{ color: c.accent, fontWeight: '600' }} onPress={() => open(TERMS_URL)}>Terms of Use</RNText>
            {' '}and{' '}
            <RNText style={{ color: c.accent, fontWeight: '600' }} onPress={() => open(PRIVACY_URL)}>Privacy Policy</RNText>
            . Abusive or objectionable content is not tolerated.
          </RNText>
        </Pressable>
        {error ? <Notice text={error} /> : null}
        <Button mode="contained" onPress={submit} loading={loading} disabled={loading || !email || !password || !flname.trim() || !accepted}
          contentStyle={{ height: 52 }} labelStyle={{ fontSize: 16, fontWeight: '700' }} style={{ borderRadius: radius.md }}>
          Create account
        </Button>
        <View style={{ marginTop: space.xl, alignItems: 'center' }}>
          <Link href="/login" accessibilityRole="link">
            <RNText style={[type.bodyStrong, { color: c.accent }]}>Already have an account? Sign in</RNText>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
