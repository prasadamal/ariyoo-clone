import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, Text, useTheme } from 'react-native-paper';
import { fetchSharedTrip, type SharedTripPayload } from '../../src/lib/shareTrip';

export default function SharedTripScreen() {
  const theme = useTheme();
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const [data, setData] = useState<SharedTripPayload | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchSharedTrip(String(shareId)).then(d => !cancelled && setData(d));
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  if (data === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!data?.trip) {
    return (
      <View style={{ flex: 1, padding: 24 }}>
        <Stack.Screen options={{ title: 'Shared journey' }} />
        <Text variant="titleLarge">Trip not available</Text>
        <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
          The link may be mistyped, you may be offline, or the owner stopped sharing this trip.
        </Text>
      </View>
    );
  }

  const { trip, entries } = data;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: trip.title }} />
      <Text variant="headlineSmall">{trip.title}</Text>
      <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
        {[trip.destination, trip.trip_type, 'read-only'].filter(Boolean).join(' · ')}
      </Text>
      {trip.notes ? <Text style={{ marginBottom: 16 }}>{trip.notes}</Text> : null}
      {(entries ?? []).map((e, idx) => (
        <Card key={idx} style={{ marginBottom: 12 }}>
          <Card.Content>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{new Date(e.recorded_at).toLocaleString()}</Text>
            {e.place_name ? <Text style={{ color: theme.colors.secondary, fontWeight: '600' }}>{e.place_name}</Text> : null}
            <Text style={{ marginTop: 6 }}>{e.body}</Text>
            {e.mood ? <Text style={{ marginTop: 4 }}>{e.mood}</Text> : null}
            {e.weather ? <Text style={{ fontSize: 12, marginTop: 4, color: theme.colors.onSurfaceVariant }}>{e.weather}</Text> : null}
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}
