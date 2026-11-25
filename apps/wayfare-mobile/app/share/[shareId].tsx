import { useLocalSearchParams } from 'expo-router';
import { stripRich } from '../../src/lib/richText';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { formatDateRange, formatKm } from '../../src/lib/format';
import { fromLngLatPairs } from '../../src/lib/geo';
import { fetchSharedTrip, type SharedTripPayload } from '../../src/lib/shareTrip';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Hero } from '../../src/ui/Hero';
import { Pill } from '../../src/ui/Pill';
import { RouteSparkline } from '../../src/ui/RouteSparkline';
import { Screen } from '../../src/ui/Screen';
import { TierBadge } from '../../src/ui/TierBadge';

export default function SharedTripScreen() {
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const { colors } = useAppTheme();
  const [data, setData] = useState<SharedTripPayload | null | undefined>(undefined);

  useEffect(() => {
    fetchSharedTrip(String(shareId)).then(setData);
  }, [shareId]);

  if (data === undefined) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!data?.trip) return <EmptyState icon="link-variant-off" title="Journey not found" body="This link may have been turned off by its owner." />;

  const { trip, entries, author, stats } = data;
  const route = fromLngLatPairs(data.route);

  return (
    <Screen>
      <Hero>
        <Text style={{ color: '#ffffffcc', fontSize: 12, fontWeight: '700' }}>A WAYFARE JOURNEY</Text>
        <Text variant="headlineSmall" style={{ color: '#fff', fontWeight: '900', marginTop: 4 }}>
          {trip.title}
        </Text>
        <Text style={{ color: '#ffffffe6' }}>{[trip.destination, formatDateRange(trip.starts_on, trip.ends_on)].filter(Boolean).join(' · ')}</Text>
        {author ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>by {author.display_name}</Text>
            {author.tier ? <TierBadge tier={author.tier} compact /> : null}
          </View>
        ) : null}
      </Hero>
      {route.length > 1 ? (
        <View style={{ marginTop: 12 }}>
          <RouteSparkline points={route} height={150} />
        </View>
      ) : null}
      {stats ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Pill icon="feather" label={`${stats.entry_count} moments`} />
          {stats.route_km > 0 ? <Pill icon="check-decagram" label={`${formatKm(stats.route_km)} GPS-verified`} color={colors.secondary} /> : null}
        </View>
      ) : null}
      {(entries ?? []).map((e, idx) => (
        <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(e.recorded_at).toLocaleString('en-IN')}</Text>
          {e.place_name ? <Text style={{ color: colors.secondary, fontWeight: '700' }}>{e.place_name}</Text> : null}
          {e.body ? <Text style={{ marginTop: 6, lineHeight: 21 }}>{stripRich(e.body)}</Text> : null}
          {e.mood || e.weather ? (
            <Text style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>{[e.mood, e.weather].filter(Boolean).join(' · ')}</Text>
          ) : null}
        </View>
      ))}
    </Screen>
  );
}
