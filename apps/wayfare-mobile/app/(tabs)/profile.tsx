import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { ActivityIndicator, Button, Card, Switch, Text } from 'react-native-paper';
import { isSupabaseConfigured } from '../../src/config';
import { useAppLock } from '../../src/context/AppLockContext';
import { useAuth } from '../../src/context/AuthContext';
import { countPendingSync } from '../../src/lib/localDb';
import { syncAll } from '../../src/lib/sync';

const PRIVACY_URL = 'https://prasadamal.github.io/ariyoo-clone/privacy/wayfare.html';

export default function ProfileTab() {
  const { user, profile, signOut, offlineMode } = useAuth();
  const { enabled: bioLock, setEnabled: setBioLock } = useAppLock();
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
      if (result.errors.length) setSyncError(result.errors.slice(0, 3).join(' · '));
      setLastSync(new Date().toLocaleString());
      await refreshPending();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text variant="headlineSmall">Profile</Text>
      <Card style={{ marginTop: 16, padding: 12, backgroundColor: '#fff' }}>
        <Text variant="titleMedium">{profile?.display_name ?? 'Traveler'}</Text>
        <Text style={{ marginTop: 4, color: '#57534e' }}>Tier: {profile?.tier ?? 'traveler'}</Text>
        {user?.email ? <Text style={{ marginTop: 8 }}>{user.email}</Text> : null}
        {offlineMode ? <Text style={{ marginTop: 8, color: '#78716c' }}>Offline journal mode</Text> : null}
      </Card>
      <Card style={{ marginTop: 12, padding: 12, backgroundColor: '#fff' }}>
        <Text variant="titleSmall">Privacy vault</Text>
        <Text style={{ marginTop: 6, color: '#57534e' }}>Require biometrics when opening the app.</Text>
        <Switch value={bioLock} onValueChange={v => setBioLock(v)} style={{ marginTop: 8 }} />
      </Card>
      <Card style={{ marginTop: 12, padding: 12, backgroundColor: '#fff' }}>
        <Text variant="titleSmall">Cloud sync</Text>
        <Text style={{ marginTop: 6, color: '#57534e' }}>
          {isSupabaseConfigured
            ? 'Auto-sync when you return to the app. Manual sync below.'
            : 'Set Supabase env vars for cloud backup.'}
        </Text>
        {!offlineMode && (
          <>
            <Text style={{ marginTop: 8 }}>Pending: {pending}</Text>
            {lastSync ? <Text style={{ color: '#57534e', fontSize: 13 }}>Last: {lastSync}</Text> : null}
            {syncError ? <Text style={{ color: '#b91c1c', marginTop: 6 }}>{syncError}</Text> : null}
            <Button mode="contained" style={{ marginTop: 12 }} onPress={runSync} disabled={syncing || !user}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            {syncing ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
          </>
        )}
      </Card>
      <Button mode="text" onPress={() => Linking.openURL(PRIVACY_URL)} style={{ marginTop: 16 }}>
        Privacy policy
      </Button>
      {!offlineMode ? (
        <Button mode="outlined" style={{ marginTop: 8 }} onPress={signOut}>Sign out</Button>
      ) : null}
      <Text style={{ marginTop: 24, color: '#a8a29e', fontSize: 12 }}>Wayfare 1.1.0 · com.wayfare.app</Text>
    </ScrollView>
  );
}
