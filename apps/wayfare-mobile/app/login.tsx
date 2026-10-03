import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';

export default function LoginScreen() {
  const { signIn, offlineMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (offlineMode) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text variant="headlineSmall">Offline journal mode</Text>
        <Text style={{ marginVertical: 12, color: '#57534e' }}>
          Supabase is not configured. You can still journal on this device. Cloud sync will activate when you add
          EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
        </Text>
        <Button mode="contained" onPress={() => router.replace('/(tabs)')}>Continue</Button>
      </View>
    );
  }

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (e: unknown) {
      setError((e as Error).message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <Text variant="headlineMedium">Your journey, journaled</Text>
      <Text style={{ color: '#57534e', marginBottom: 24 }}>Private trips first. Community comes later.</Text>
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ marginBottom: 12 }} />
      <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ marginBottom: 12 }} />
      {error ? <Text style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</Text> : null}
      <Button mode="contained" onPress={submit} loading={loading}>Sign in</Button>
      <Link href="/register" asChild>
        <Button style={{ marginTop: 12 }}>Create account</Button>
      </Link>
    </ScrollView>
  );
}
