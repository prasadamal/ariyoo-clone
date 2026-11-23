import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { formatDay, toDayString } from '../src/lib/format';
import { searchJournal } from '../src/lib/journalSearch';
import { listAllEntries, listTrips, type LocalEntry, type LocalTrip } from '../src/lib/localDb';
import { useAppTheme } from '../src/theme';
import { Icon } from '../src/ui/Icon';

/** Search everything you've written: moments, diary pages and journeys. Works offline. */
export default function FindScreen() {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<{ entries: LocalEntry[]; trips: LocalTrip[] } | null>(null);

  useEffect(() => {
    Promise.all([listAllEntries(), listTrips()]).then(([entries, trips]) => setData({ entries, trips })).catch(() => setData({ entries: [], trips: [] }));
  }, []);

  const hits = useMemo(() => (data ? searchJournal(data.entries, data.trips, query) : []), [data, query]);
  const everydayIds = useMemo(() => new Set((data?.trips ?? []).filter(t => t.trip_type === 'everyday').map(t => t.id)), [data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TextInput
          mode="outlined"
          placeholder="Search moments, places, moods…"
          value={query}
          onChangeText={setQuery}
          autoFocus
          left={<TextInput.Icon icon="magnify" />}
          right={query ? <TextInput.Icon icon="close" onPress={() => setQuery('')} accessibilityLabel="Clear search" /> : undefined}
          accessibilityLabel="Search your journal"
        />
      </View>
      <FlatList
        data={hits}
        keyExtractor={h => `${h.kind}-${h.id}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8 }}
        ListEmptyComponent={
          query.trim().length >= 2 ? (
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 30 }}>Nothing found for “{query.trim()}”.</Text>
          ) : (
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 30 }}>Find that café in Kochi, or the day it rained.</Text>
          )
        }
        renderItem={({ item }) =>
          item.kind === 'trip' ? (
            <Pressable onPress={() => router.push(`/trip/${item.id}`)} accessibilityRole="button" style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: colors.primaryContainer }}>
              <Icon name="map-marker-path" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800' }} numberOfLines={1}>{item.title}</Text>
                {item.detail ? <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{item.detail}</Text> : null}
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => (everydayIds.has(item.tripId) ? router.push('/(tabs)/journal') : router.push(`/trip/${item.tripId}`))}
              accessibilityRole="button"
              style={{ padding: 14, borderRadius: 16, backgroundColor: colors.surfaceVariant }}
            >
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                {formatDay(toDayString(new Date(item.at)))} · {item.tripTitle}
              </Text>
              <Text style={{ marginTop: 4, lineHeight: 20 }} numberOfLines={3}>{item.snippet}</Text>
            </Pressable>
          )
        }
      />
    </View>
  );
}
