import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, Text } from 'react-native-paper';
import { useWayfareTheme } from '../../src/context/ThemeContext';
import { fetchSharedTrip, type SharedTripPayload } from '../../src/lib/shareTrip';

export default function SharedTripScreen() {
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const id = String(shareId);
  const { paperTheme } = useWayfareTheme();
  const [data, setData] = useState<SharedTripPayload | null | undefined>(undefined);

  useEffect(() => {
    fetchSharedTrip(id).then(setData);
  }, [id]);

  if (data === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: paperTheme.colors.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!data?.trip) {
    return (
      <View style={{ flex: 1, padding: 24, backgroundColor: paperTheme.colors.background }}>
        <Text variant="titleLarge">Trip not found</Text>
        <Text style={{ marginTop: 8, color: paperTheme.colors.onSurfaceVariant }}>
          This link may have expired or the trip is no longer shared.
        </Text>
      </View>
    );
  }

  const { trip, entries } = data;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: paperTheme.colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text variant="headlineSmall">{trip.title}</Text>
      <Text style={{ color: paperTheme.colors.onSurfaceVariant, marginBottom: 16 }}>
        {trip.destination} · {trip.trip_type} · Read-only share
      </Text>
      {(entries ?? []).map((e, idx) => (
        <Card key={idx} style={{ marginBottom: 12, backgroundColor: paperTheme.colors.surface }}>
          <Card.Content>
            <Text variant="labelSmall">{new Date(e.recorded_at).toLocaleString()}</Text>
            {e.place_name ? <Text style={{ color: '#0f766e' }}>{e.place_name}</Text> : null}
            <Text style={{ marginTop: 6 }}>{e.body}</Text>
            {e.mood ? <Text style={{ marginTop: 4 }}>{e.mood}</Text> : null}
            {e.weather ? <Text style={{ fontSize: 12, marginTop: 4 }}>{e.weather}</Text> : null}
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}
