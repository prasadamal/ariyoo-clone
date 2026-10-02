import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Checkbox, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';

export default function Register() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [flname, setFlname] = useState('');
  const [isSeeker, setIsSeeker] = useState(true);
  const [isSolver, setIsSolver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    try {
      setLoading(true);
      setError('');
      await signUp({ email: email.trim(), password, flname: flname.trim(), isSeeker, isSolver });
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Registration failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text variant="headlineMedium" style={{ marginBottom: 8 }}>Join Ariyoo</Text>
        <Text style={{ color: '#94a3b8', marginBottom: 24 }}>Ask questions or help others as an expert.</Text>
        <TextInput mode="outlined" label="Full name" value={flname} onChangeText={setFlname} style={{ marginBottom: 12 }} />
        <TextInput
          mode="outlined"
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{ marginBottom: 12 }}
        />
        <TextInput
          mode="outlined"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{ marginBottom: 12 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Checkbox status={isSeeker ? 'checked' : 'unchecked'} onPress={() => setIsSeeker(!isSeeker)} />
          <Text>I want to ask questions (Seeker)</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Checkbox status={isSolver ? 'checked' : 'unchecked'} onPress={() => setIsSolver(!isSolver)} />
          <Text>I can answer as an expert (Solver)</Text>
        </View>
        {error ? <Text style={{ color: '#f87171', marginBottom: 12 }}>{error}</Text> : null}
        <Button mode="contained" onPress={submit} loading={loading} disabled={!email || !password || !flname}>
          Create account
        </Button>
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <Link href="/login">
            <Text style={{ color: '#38bdf8' }}>Already have an account? Sign in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
