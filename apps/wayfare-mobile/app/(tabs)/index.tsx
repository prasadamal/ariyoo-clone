import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, FAB, Text } from 'react-native-paper';
import { listTrips, type LocalTrip } from '../../src/lib/localDb';
import { syncAll } from '../../src/lib/sync';
import { useAuth } from '../../src/context/AuthContext';

export default function JournalTab() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<LocalTrip[]>([]);
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(async () => {
    setTrips(await listTrips());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sync = async () => {
    if (!user) {
      setSyncMsg('Sign in to sync to cloud');
      return;
    }
    const result = await syncAll(user.id);
    const pushed =
      result.pushed.trips +
      result.pushed.entries +
      result.pushed.expenses +
      result.pushed.packing +
      result.pushed.track_points +
      result.pushed.media;
    setSyncMsg(
      result.errors.length
        ? result.errors[0]
        : `Synced (pushed ${pushed}, pulled ${result.pulled.trips + result.pulled.entries} items)`
    );
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fafaf9' }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="headlineSmall">Your trips</Text>
        <Button onPress={sync} compact>Sync</Button>
      </View>
      {syncMsg ? <Text style={{ paddingHorizontal: 16, color: '#57534e' }}>{syncMsg}</Text> : null}
      <FlatList
        data={trips}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        ListEmptyComponent={
          <Card style={{ padding: 16 }}>
            <Text variant="titleMedium">Start a journal</Text>
            <Text style={{ marginTop: 8, color: '#57534e' }}>
              Plan a trek, log entries offline, track your route, and manage budget and packing in one place.
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 12 }} onPress={() => router.push(`/trip/${item.id}`)}>
            <Card.Title title={item.title} subtitle={`${item.trip_type} · ${item.destination ?? 'No destination'}`} />
            <Card.Content>
              <Text variant="bodySmall">{item.starts_on ?? 'Dates TBD'} → {item.ends_on ?? '—'}</Text>
              <Text variant="bodySmall">Sync: {item.sync_status}</Text>
            </Card.Content>
          </Card>
        )}
      />
      <FAB icon="plus" style={{ position: 'absolute', right: 16, bottom: 16 }} onPress={() => router.push('/trip/new')} />
    </View>
  );
}
