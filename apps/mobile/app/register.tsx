import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { Button, Checkbox, Text, TextInput } from 'react-native-paper';
import { errorMessage } from '../src/api/client';
import { PRIVACY_URL, TERMS_URL } from '../src/config';
import { useAuth } from '../src/context/AuthContext';
import { emailProblem, MIN_PASSWORD, passwordProblem } from '../src/lib/validation';

const open = (url: string) => Linking.openURL(url).catch(() => undefined);

export default function Register() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [flname, setFlname] = useState('');
  const [isSolver, setIsSolver] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text variant="headlineMedium" style={{ marginBottom: 8 }}>Join Ariyoo</Text>
        <Text style={{ color: '#94a3b8', marginBottom: 24 }}>Ask questions, or answer them for places and topics you know well.</Text>
        <TextInput mode="outlined" label="Full name" value={flname} onChangeText={setFlname} autoComplete="name" textContentType="name" maxLength={100} style={{ marginBottom: 12 }} />
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
          autoComplete="new-password"
          textContentType="newPassword"
          style={{ marginBottom: 4 }}
        />
        <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>At least {MIN_PASSWORD} characters. A short sentence works well.</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Checkbox.Android status={isSolver ? 'checked' : 'unchecked'} onPress={() => setIsSolver(!isSolver)} />
          <Text style={{ flex: 1 }} onPress={() => setIsSolver(!isSolver)}>I also want to answer questions as an expert</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Checkbox.Android status={accepted ? 'checked' : 'unchecked'} onPress={() => setAccepted(!accepted)} />
          <Text style={{ flex: 1 }}>
            I am 18 or older and agree to the{' '}
            <Text style={{ color: '#38bdf8' }} onPress={() => open(TERMS_URL)}>Terms of Use</Text>
            {' '}and{' '}
            <Text style={{ color: '#38bdf8' }} onPress={() => open(PRIVACY_URL)}>Privacy Policy</Text>
            . Abusive or objectionable content is not tolerated.
          </Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: '#f87171', marginBottom: 12 }}>{error}</Text> : null}
        <Button mode="contained" onPress={submit} loading={loading} disabled={loading || !email || !password || !flname.trim() || !accepted}>
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
