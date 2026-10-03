import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await signUp(email.trim(), password, displayName.trim());
    } catch (e: unknown) {
      setError((e as Error).message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <Text variant="headlineMedium">Join Wayfare</Text>
      <TextInput label="Display name" value={displayName} onChangeText={setDisplayName} style={{ marginTop: 16, marginBottom: 12 }} />
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ marginBottom: 12 }} />
      <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ marginBottom: 12 }} />
      {error ? <Text style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</Text> : null}
      <Button mode="contained" onPress={submit} loading={loading} disabled={!displayName || !email || password.length < 8}>
        Create account
      </Button>
      <Link href="/login" asChild>
        <Button style={{ marginTop: 12 }}>Back to sign in</Button>
      </Link>
    </ScrollView>
  );
}
