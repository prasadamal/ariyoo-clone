import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { isEverydayTrip, onThisDay, type MemoryGroup } from '../lib/everydayMemories';
import { listAllEntries, listTrips, type LocalEntry, type LocalTrip } from '../lib/localDb';
import { stripRich } from '../lib/richText';
import { useAppTheme } from '../theme';
import { Icon } from '../ui/Icon';

/**
 * "On this day": what you wrote on today's date in earlier years, as one small card. Nothing shows
 * when there's no memory for today.
 */
export function OnThisDayCard({ refreshKey }: { refreshKey?: string | null }) {
  const { colors } = useAppTheme();
  const [memory, setMemory] = useState<{ group: MemoryGroup<LocalEntry>; trip: LocalTrip | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listAllEntries(), listTrips()])
        .then(([entries, trips]) => {
          if (!active) return;
          const groups = onThisDay(entries.filter(e => !e.author_id), new Date());
          const group = groups[0];
          setMemory(group ? { group, trip: trips.find(t => t.id === group.entries[0].trip_id) ?? null } : null);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [refreshKey])
  );

  if (!memory) return null;
  const { group, trip } = memory;
  const first = group.entries.find(e => e.body && e.body !== '📷' && e.body !== '🎙 Voice note') ?? group.entries[0];
  const words = first.body && first.body !== '📷' ? stripRich(first.body).replace(/\s+/g, ' ').trim() : 'A photo moment';
  const everyday = trip ? isEverydayTrip(trip) : false;
  const open = () => (everyday || !trip ? router.push('/(tabs)/journal') : router.push(`/trip/${trip.id}`));
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`On this day, ${group.yearsAgo} ${group.yearsAgo === 1 ? 'year' : 'years'} ago: ${words}`}
      style={({ pressed }) => ({ marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: colors.secondaryContainer, opacity: pressed ? 0.9 : 1, flexDirection: 'row', gap: 12, alignItems: 'center' })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="history" size={22} color={colors.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: colors.onSecondaryContainer }}>
          ON THIS DAY · {group.yearsAgo} {group.yearsAgo === 1 ? 'YEAR' : 'YEARS'} AGO
        </Text>
        <Text style={{ color: colors.onSecondaryContainer, marginTop: 2 }} numberOfLines={2}>
          {first.mood ? `${first.mood.split(' ')[0]} ` : ''}
          {words}
        </Text>
        {trip && !everyday ? (
          <Text style={{ color: colors.onSecondaryContainer, opacity: 0.75, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {trip.title}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={20} color={colors.onSecondaryContainer} />
    </Pressable>
  );
}
