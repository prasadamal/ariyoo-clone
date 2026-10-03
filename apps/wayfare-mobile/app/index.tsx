import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const { loading, session, offlineMode } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#c2410c" />
        <Text style={{ marginTop: 12 }}>Wayfare</Text>
      </View>
    );
  }

  if (offlineMode || session) return <Redirect href="/(tabs)" />;
  return <Redirect href="/login" />;
}
