import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTokens } from '../src/design/tokens';
import { useAuth } from '../src/context/AuthContext';
import { isApiConfigured, SUPPORT_EMAIL } from '../src/config';

export default function Index() {
  const { user, loading } = useAuth();
  const { c } = useTokens();

  // A build made without its server address. The release preflight stops this before upload;
  // this screen is the safety net so nobody stares at endless spinners.
  if (!isApiConfigured) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: c.bg }}>
        <Text variant="headlineSmall" style={{ marginBottom: 8 }}>Ariyoo is not connected</Text>
        <Text style={{ color: c.textMuted }}>
          This version was built without a server address. Please update the app, or write to {SUPPORT_EMAIL}.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={{ marginTop: 12, color: c.textMuted }}>Loading Ariyoo…</Text>
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/login" />;
}
