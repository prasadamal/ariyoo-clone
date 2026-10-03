import { ScrollView, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { isSupabaseConfigured } from '../../src/config';
import { useAuth } from '../../src/context/AuthContext';

export default function ProfileTab() {
  const { user, profile, signOut, offlineMode } = useAuth();

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text variant="headlineSmall">Profile</Text>
      <Card style={{ marginTop: 16, padding: 12 }}>
        <Text variant="titleMedium">{profile?.display_name ?? 'Traveler'}</Text>
        <Text>Tier: {profile?.tier ?? 'traveler'} (verified journeys only — social metrics never affect tier)</Text>
        {profile?.home_region ? <Text>Home region: {profile.home_region}</Text> : null}
        {user?.email ? <Text style={{ marginTop: 8 }}>{user.email}</Text> : null}
      </Card>
      <Card style={{ marginTop: 12, padding: 12 }}>
        <Text variant="titleSmall">Cloud sync</Text>
        <Text style={{ marginTop: 6 }}>
          {isSupabaseConfigured ? 'Supabase configured — journal syncs when online.' : 'Offline-only until Supabase env vars are set.'}
        </Text>
        {offlineMode ? <Text style={{ marginTop: 6, color: '#57534e' }}>Local SQLite is the source of truth on device.</Text> : null}
      </Card>
      {!offlineMode ? (
        <Button mode="outlined" style={{ marginTop: 24 }} onPress={signOut}>Sign out</Button>
      ) : null}
    </ScrollView>
  );
}
