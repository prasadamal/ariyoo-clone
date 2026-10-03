import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Button, Card, FAB, ProgressBar, Text } from 'react-native-paper';
import { listTrips, type LocalTrip } from '../../src/lib/localDb';
import { computeTripStats, buildTripSynopsis } from '../../src/lib/tripStats';
import { syncAll } from '../../src/lib/sync';
import { useAuth } from '../../src/context/AuthContext';

type TripRow = LocalTrip & { synopsis: string; packingRatio: number };

export default function JournalTab() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [syncMsg, setSyncMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const raw = await listTrips();
    const enriched: TripRow[] = await Promise.all(
      raw.map(async t => {
        const stats = await computeTripStats(t.id);
        return {
          ...t,
          synopsis: buildTripSynopsis(t.title, stats),
          packingRatio: stats.packingTotal ? stats.packingDone / stats.packingTotal : 0,
        };
      })
    );
    setTrips(enriched);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    if (user) {
      const result = await syncAll(user.id);
      setSyncMsg(result.errors.length ? result.errors[0] : 'Cloud sync complete');
    }
    await load();
    setRefreshing(false);
  };

  const sync = async () => {
    if (!user) {
      setSyncMsg('Sign in to sync to cloud');
      return;
    }
    await onRefresh();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fafaf9' }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Text variant="headlineSmall">Your journeys</Text>
        <Text style={{ color: '#57534e', marginTop: 4 }}>Private by default. Yours forever.</Text>
        <Button onPress={sync} compact style={{ alignSelf: 'flex-start', marginTop: 8 }}>Sync cloud</Button>
        {syncMsg ? <Text style={{ marginTop: 6, color: '#57534e', fontSize: 13 }}>{syncMsg}</Text> : null}
      </View>
      <FlatList
        data={trips}
        keyExtractor={t => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c2410c" />}
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        ListEmptyComponent={
          <Card style={{ padding: 20, backgroundColor: '#fff' }}>
            <Text variant="titleLarge">Start your first trip</Text>
            <Text style={{ marginTop: 10, color: '#57534e', lineHeight: 22 }}>
              Log journal entries offline, track budget and packing, record your route, and export a PDF travel log when you are done.
            </Text>
            <Button mode="contained" style={{ marginTop: 16 }} onPress={() => router.push('/trip/new')}>
              Create trip
            </Button>
            <Button style={{ marginTop: 8 }} onPress={() => router.push('/(tabs)/explore')}>
              Browse trek guides
            </Button>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 14, backgroundColor: '#fff' }} onPress={() => router.push(`/trip/${item.id}`)}>
            <Card.Title
              title={item.title}
              subtitle={`${item.trip_type} · ${item.destination ?? 'Destination TBD'}`}
              titleNumberOfLines={2}
            />
            <Card.Content>
              <Text variant="bodySmall" style={{ color: '#57534e', marginBottom: 8 }}>{item.synopsis}</Text>
              {item.packingRatio > 0 ? (
                <ProgressBar progress={item.packingRatio} color="#0f766e" style={{ height: 6, borderRadius: 3 }} />
              ) : null}
              <Text variant="labelSmall" style={{ marginTop: 8, color: '#a8a29e' }}>
                {item.status === 'completed' ? 'Completed · ' : ''}Sync: {item.sync_status}
              </Text>
            </Card.Content>
          </Card>
        )}
      />
      <FAB icon="plus" style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: '#c2410c' }} onPress={() => router.push('/trip/new')} />
    </View>
  );
}
