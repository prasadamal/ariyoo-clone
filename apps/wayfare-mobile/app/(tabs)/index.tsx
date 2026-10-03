import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { ActivityIndicator, Button, Card, FAB, ProgressBar, Text, useTheme } from 'react-native-paper';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import { listTrips, type LocalTrip } from '../../src/lib/localDb';
import { buildTripSynopsis, computeTripStats } from '../../src/lib/tripStats';

type TripRow = LocalTrip & { synopsis: string; packingRatio: number };

export default function JournalTab() {
  const theme = useTheme();
  const { user, guest } = useAuth();
  const { syncNow, syncing, pending, offline, lastError, dataVersion } = useSync();
  const [trips, setTrips] = useState<TripRow[] | null>(null);

  const load = useCallback(async () => {
    const raw = await listTrips();
    setTrips(
      await Promise.all(
        raw.map(async t => {
          const stats = await computeTripStats(t.id);
          return { ...t, synopsis: buildTripSynopsis(t.title, stats), packingRatio: stats.packingTotal ? stats.packingDone / stats.packingTotal : 0 };
        })
      )
    );
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { load(); }, [load, dataVersion]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text variant="headlineSmall">Your journeys</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 2, marginBottom: 12 }}>Private by default. Yours forever.</Text>
        {guest && !user ? (
          <StatusBanner kind="info">You are using Wayfare without an account. Sign in from Profile to back up and sync your journeys.</StatusBanner>
        ) : null}
        {user && offline ? <StatusBanner kind="info">You are offline. Changes are saved on this phone and will sync when you reconnect.</StatusBanner> : null}
        {user && !offline && lastError ? <StatusBanner kind="error">Some changes could not sync yet: {lastError}</StatusBanner> : null}
        {user && pending > 0 && !syncing && !offline && !lastError ? <StatusBanner kind="info">{pending} change{pending === 1 ? '' : 's'} waiting to sync.</StatusBanner> : null}
      </View>
      {trips === null ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={t => t.id}
          refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => { syncNow(); }} tintColor={theme.colors.primary} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          ListEmptyComponent={
            <Card style={{ padding: 20 }}>
              <Text variant="titleLarge">Start your first trip</Text>
              <Text style={{ marginTop: 10, color: theme.colors.onSurfaceVariant, lineHeight: 22 }}>
                Log journal entries offline, track your budget and packing, record your route, and export a PDF travel log when you are back.
              </Text>
              <Button mode="contained" style={{ marginTop: 16 }} onPress={() => router.push('/trip/new')}>Create trip</Button>
              <Button style={{ marginTop: 8 }} onPress={() => router.push('/(tabs)/explore')}>Browse trek guides</Button>
            </Card>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 14 }} onPress={() => router.push(`/trip/${item.id}`)} accessibilityLabel={`Open trip ${item.title}`}>
              <Card.Title title={item.title} subtitle={`${item.trip_type} · ${item.destination ?? 'Destination TBD'}`} titleNumberOfLines={2} />
              <Card.Content>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>{item.synopsis}</Text>
                {item.packingRatio > 0 ? <ProgressBar progress={item.packingRatio} color={theme.colors.secondary} style={{ height: 6, borderRadius: 3 }} /> : null}
                <Text variant="labelSmall" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
                  {item.status === 'completed' ? 'Completed' : 'In progress'}
                  {user ? (item.sync_status === 'pending' ? ' · waiting to sync' : ' · backed up') : ''}
                </Text>
              </Card.Content>
            </Card>
          )}
        />
      )}
      <FAB icon="plus" style={{ position: 'absolute', right: 16, bottom: 16 }} onPress={() => router.push('/trip/new')} label="New trip" accessibilityLabel="Create a new trip" />
    </View>
  );
}
