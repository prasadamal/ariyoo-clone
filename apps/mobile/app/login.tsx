import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, Text as RNText, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '../src/api/client';
import { SUPPORT_EMAIL } from '../src/config';
import { useAuth } from '../src/context/AuthContext';
import { radius, space, type, useTokens } from '../src/design/tokens';
import { Notice } from '../src/design/ui';

export default function Login() {
  const { signIn } = useAuth();
  const { c } = useTokens();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (loading || !email.trim() || !password) return;
    try {
      setLoading(true);
      setError('');
      await signIn(email.trim(), password);
    } catch (e: unknown) {
      setError(errorMessage(e, 'Sign in failed. Check your email and password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.xxl }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
              <RNText style={{ color: c.onAccent, fontSize: 22, fontWeight: '800' }}>?</RNText>
            </View>
            <RNText style={{ color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>ariyoo</RNText>
          </View>
          <RNText accessibilityRole="header" style={[type.display, { color: c.text }]}>
            Ariyo?{'\n'}Ask someone who knows.
          </RNText>
          <RNText style={[type.body, { color: c.textMuted, marginTop: space.md, marginBottom: space.xxl }]}>
            Real answers from locals and travellers who have been there.
          </RNText>
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
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            right={<TextInput.Icon icon={show ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShow(s => !s)} accessibilityLabel={show ? 'Hide password' : 'Show password'} />}
            style={{ marginBottom: space.lg, backgroundColor: c.surface }}
          />
          {error ? <Notice text={error} /> : null}
          <Button mode="contained" onPress={submit} loading={loading} disabled={loading || !email.trim() || !password}
            contentStyle={{ height: 52 }} labelStyle={{ fontSize: 16, fontWeight: '700' }} style={{ borderRadius: radius.md }}>
            Sign in
          </Button>
          <View style={{ marginTop: space.xl, alignItems: 'center', gap: space.lg }}>
            <Link href="/register" accessibilityRole="link">
              <RNText style={[type.bodyStrong, { color: c.accent }]}>New here? Create an account</RNText>
            </Link>
            <RNText
              accessibilityRole="link"
              style={[type.small, { color: c.textMuted, textAlign: 'center' }]}
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ariyoo password help')}`).catch(() => undefined)}
            >
              Forgot your password? <RNText style={{ color: c.accent, fontWeight: '600' }}>Email us</RNText>
            </RNText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
