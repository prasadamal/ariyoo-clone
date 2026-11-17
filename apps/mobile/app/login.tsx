import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { errorMessage } from '../src/api/client';
import { SUPPORT_EMAIL } from '../src/config';
import { useAuth } from '../src/context/AuthContext';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (loading) return;
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text variant="headlineMedium" style={{ marginBottom: 8 }}>Welcome back</Text>
        <Text style={{ color: '#94a3b8', marginBottom: 24 }}>Ask people who have been there.</Text>
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
          style={{ marginBottom: 12 }}
        />
        <TextInput
          mode="outlined"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
          style={{ marginBottom: 12 }}
        />
        {error ? <Text accessibilityRole="alert" style={{ color: '#f87171', marginBottom: 12 }}>{error}</Text> : null}
        <Button mode="contained" onPress={submit} loading={loading} disabled={loading || !email || !password}>
          Sign in
        </Button>
        <View style={{ marginTop: 16, alignItems: 'center', gap: 12 }}>
          <Link href="/register">
            <Text style={{ color: '#38bdf8' }}>Create an account</Text>
          </Link>
          <Text
            style={{ color: '#94a3b8', textAlign: 'center' }}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ariyoo password help')}`).catch(() => undefined)}
          >
            Forgot your password? Write to {SUPPORT_EMAIL}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
