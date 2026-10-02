import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={{ marginTop: 12, color: '#94a3b8' }}>Loading Ariyoo…</Text>
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/login" />;
}
