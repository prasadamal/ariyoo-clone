import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';
import { isSupabaseConfigured } from '../../src/config';
import { useAuth } from '../../src/context/AuthContext';
import { countPendingSync } from '../../src/lib/localDb';
import { syncAll } from '../../src/lib/sync';

export default function ProfileTab() {
  const { user, profile, signOut, offlineMode } = useAuth();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    setPending(await countPendingSync());
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const runSync = async () => {
    if (!user?.id) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await syncAll(user.id);
      if (result.errors.length) {
        setSyncError(result.errors.slice(0, 3).join(' · '));
      }
      setLastSync(new Date().toLocaleString());
      await refreshPending();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

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
          {isSupabaseConfigured
            ? 'Trips, journal, budget, packing, GPS points, and photos sync to Supabase.'
            : 'Offline-only until Supabase env vars are set.'}
        </Text>
        {offlineMode ? (
          <Text style={{ marginTop: 6, color: '#57534e' }}>Local SQLite is the source of truth on device.</Text>
        ) : (
          <>
            <Text style={{ marginTop: 8 }}>Pending changes on device: {pending}</Text>
            {lastSync ? <Text style={{ marginTop: 4, color: '#57534e' }}>Last sync: {lastSync}</Text> : null}
            {syncError ? <Text style={{ marginTop: 6, color: '#b91c1c' }}>{syncError}</Text> : null}
            <Button
              mode="contained"
              style={{ marginTop: 12 }}
              onPress={runSync}
              disabled={syncing || !user}
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            {syncing ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
          </>
        )}
      </Card>
      {!offlineMode ? (
        <Button mode="outlined" style={{ marginTop: 24 }} onPress={signOut}>Sign out</Button>
      ) : null}
    </ScrollView>
  );
}
