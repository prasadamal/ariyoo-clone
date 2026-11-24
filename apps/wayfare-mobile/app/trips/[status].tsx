import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Text } from 'react-native-paper';
import { TripCard } from '../../src/components/TripCard';
import { useAuth } from '../../src/context/AuthContext';
import { journeysOnly } from '../../src/lib/everydayMemories';
import { listTrips } from '../../src/lib/localDb';
import { statusTrips, type TripStatus } from '../../src/lib/tripList';
import { prepareTripRows, type TripRow } from '../../src/lib/tripRows';
import { useAppTheme } from '../../src/theme';

const TITLES: Record<TripStatus, string> = { ongoing: 'On going', upcoming: 'Coming soon', completed: 'Completed' };

/** Every journey in one group (opened from its tile on Journeys): coming up soonest first, or done newest first. */
export default function TripsByStatus() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ status: string }>();
  const status: TripStatus = params.status === 'upcoming' || params.status === 'ongoing' ? params.status : 'completed';
  const [rows, setRows] = useState<TripRow[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listTrips()
        .then(all => prepareTripRows(statusTrips(journeysOnly(all), status)))
        .then(list => alive && setRows(list))
        .catch(() => alive && setRows([]));
      return () => {
        alive = false;
      };
    }, [status])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: TITLES[status] }} />
      {rows === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>No journeys here yet.</Text>}
          renderItem={({ item }) => <TripCard trip={item} synopsis={item.synopsis} coverUri={item.cover} showUpload={Boolean(user)} />}
        />
      )}
    </View>
  );
}
