import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/theme';
import { Hero } from '../src/ui/Hero';
import { Notice } from '../src/ui/Notice';
import { Screen } from '../src/ui/Screen';

export default function LoginScreen() {
  const { signIn, offlineMode, continueAsGuest } = useAuth();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (offlineMode) {
    return (
      <Screen>
        <Text variant="headlineSmall" style={{ fontWeight: '800' }}>
          Offline journal mode
        </Text>
        <Text style={{ marginVertical: 12, color: colors.muted, lineHeight: 21 }}>
          Cloud features are not configured in this build. You can still journal on this device. Sync and community activate when
          EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.
        </Text>
        <Button mode="contained" onPress={() => router.replace('/(tabs)')}>
          Continue
        </Button>
      </Screen>
    );
  }

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (e: unknown) {
      const msg = (e as Error).message || 'Sign in failed';
      setError(/email not confirmed/i.test(msg) ? 'Confirm your email first — check your inbox for the link.' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Hero>
        <Text variant="headlineMedium" style={{ color: '#fff', fontWeight: '800' }}>
          Welcome back
        </Text>
        <Text style={{ color: '#ffffffd9', marginTop: 4 }}>Your journeys and your travel people are waiting.</Text>
      </Hero>
      <View style={{ marginTop: 20, gap: 12 }}>
        <TextInput
          mode="outlined"
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextInput
          mode="outlined"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete="password"
          textContentType="password"
          right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(!showPassword)} />}
          onSubmitEditing={submit}
        />
        {error ? <Notice tone="error" text={error} /> : null}
        <Button mode="contained" onPress={submit} loading={loading} disabled={loading || !email || !password}>
          Sign in
        </Button>
        <Link href="/forgot-password" asChild>
          <Button compact>Forgot password?</Button>
        </Link>
      </View>
      <View style={{ marginTop: 28, gap: 8 }}>
        <Link href="/register" asChild>
          <Button mode="outlined" icon="account-plus-outline">
            Create a free account
          </Button>
        </Link>
        <Button onPress={continueAsGuest} icon="notebook-outline">
          Just journal for now (no account)
        </Button>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
          Without an account your journal stays on this phone. Sign up any time to back it up and meet travellers.
        </Text>
      </View>
    </Screen>
  );
}
