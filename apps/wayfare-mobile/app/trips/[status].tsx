import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Text } from 'react-native-paper';
import { TripCard } from '../../src/components/TripCard';
import { useAuth } from '../../src/context/AuthContext';
import { journeysOnly } from '../../src/lib/everydayMemories';
import { listTrips } from '../../src/lib/localDb';
import { statusTrips, type TripStatus } from '../../src/lib/tripList';
import { loadPins, setPinned } from '../../src/lib/pins';
import { useToast } from '../../src/context/ToastContext';
import { prepareTripRows, type TripRow } from '../../src/lib/tripRows';
import { useAppTheme } from '../../src/theme';

const TITLES: Record<TripStatus, string> = { ongoing: 'On going', upcoming: 'Coming soon', completed: 'Completed' };

/**
 * Every journey in one group (opened from its tile on Journeys): pinned ones first, then on the road
 * and coming up soonest first, or done newest first. Long-press a journey to pin or unpin it.
 */
export default function TripsByStatus() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ status: string }>();
  const status: TripStatus = params.status === 'upcoming' || params.status === 'ongoing' ? params.status : 'completed';
  const [rows, setRows] = useState<TripRow[] | null>(null);
  const [pins, setPins] = useState<string[]>([]);
  const [epoch, setEpoch] = useState(0);
  const toast = useToast();
  const owner = user?.id ?? 'guest';

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([listTrips(), loadPins(owner)])
        .then(async ([all, pinned]) => {
          const list = await prepareTripRows(statusTrips(journeysOnly(all), status, new Date(), pinned));
          if (!alive) return;
          setPins(pinned);
          setRows(list);
        })
        .catch(() => alive && setRows([]));
      return () => {
        alive = false;
      };
    }, [status, owner, epoch])
  );

  const togglePin = async (t: TripRow) => {
    const pin = !pins.includes(t.id);
    try {
      await setPinned(owner, t.id, pin);
      toast(pin ? `Pinned ${t.title} to the top` : `Unpinned ${t.title}`);
      setEpoch(e => e + 1);
    } catch {
      toast('Could not change the pin. Try again.');
    }
  };

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
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              synopsis={item.synopsis}
              coverUri={item.cover}
              showUpload={Boolean(user)}
              pinned={pins.includes(item.id)}
              onLongPress={() => void togglePin(item)}
            />
          )}
        />
      )}
    </View>
  );
}
