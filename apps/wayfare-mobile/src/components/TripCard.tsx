import { TripCover } from '../ui/TripCover';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { getDestination } from '../content/destinations';
import { daysUntil, formatDateRange, tripPhase } from '../lib/format';
import type { LocalTrip } from '../lib/localDb';
import { useAppTheme } from '../theme';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { Meter } from '../ui/Meter';
import { SOCIAL_ENABLED } from '../lib/features';
import { BudgetBar } from '../ui/BudgetBar';

const TYPE_ICONS: Record<string, string> = {
  trek: 'hiking',
  road: 'car-side',
  city: 'city-variant-outline',
  beach: 'beach',
  backpacking: 'bag-personal-outline',
  pilgrimage: 'meditation',
  wildlife: 'paw',
  international: 'airplane',
};

export function tripTypeIcon(type: string) {
  return TYPE_ICONS[type] ?? 'map-outline';
}

/** coverUri: the cover to show (your chosen photo, or the newest moment photo). */
type Props = { trip: LocalTrip; synopsis: string; packingRatio: number; tracking?: boolean; spentAmount?: number; coverUri?: string | null };

export function TripCard({ trip, synopsis, packingRatio, tracking, spentAmount = 0, coverUri }: Props) {
  const cover = coverUri === undefined ? trip.cover_uri : coverUri;
  const { colors } = useAppTheme();
  const phase = tripPhase(trip.starts_on, trip.ends_on);
  const until = daysUntil(trip.starts_on);
  const dest = getDestination(trip.place_key);
  // One cover colour for every journey without a photo (the same as the journey page).
  const gradient: [string, string] = [colors.heroStart, colors.heroEnd];
  const phaseLabel =
    trip.status === 'completed'
      ? 'Completed'
      : phase === 'upcoming' && until != null
        ? until === 0
          ? 'Starts today'
          : `In ${until} day${until === 1 ? '' : 's'}`
        : phase === 'ongoing'
          ? 'On the road'
          : phase === 'past'
            ? 'Past trip'
            : 'Dreaming';
  return (
    <Pressable
      onPress={() => router.push(`/trip/${trip.id}`)}
      style={({ pressed }) => ({ marginBottom: 14, borderRadius: 20, overflow: 'hidden', opacity: pressed ? 0.9 : 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border })}
      accessibilityRole="button"
      accessibilityLabel={`${trip.title}, ${phaseLabel}`}
    >
      <TripCover uri={cover} gradient={gradient} style={{ padding: 16, minHeight: cover ? 150 : 104 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={tripTypeIcon(trip.trip_type)} size={18} color="#fff" />
          <Text style={{ color: '#ffffffcc', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, flex: 1 }}>
            {phaseLabel.toUpperCase()}
          </Text>
          {tracking ? <Pill icon="record-circle" label="Recording" color="#fff" background="#dc2626" /> : null}
          {SOCIAL_ENABLED && trip.open_to_meet ? <Icon name="account-group" size={18} color="#fff" /> : null}
          {(trip.crew_count ?? 0) > 1 ? (
            <View accessibilityLabel={`Shared with ${trip.crew_count} people`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name="account-multiple" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{trip.crew_count}</Text>
            </View>
          ) : null}
          {trip.sync_status === 'pending' ? <Icon name="cloud-upload-outline" size={16} color="#ffffffaa" /> : null}
        </View>
        <Text variant="titleLarge" style={{ color: '#fff', fontWeight: '800', marginTop: 10 }} numberOfLines={2}>
          {trip.title}
        </Text>
        <Text style={{ color: '#ffffffd9', marginTop: 2 }} numberOfLines={1}>
          {[dest?.name ?? trip.destination, formatDateRange(trip.starts_on, trip.ends_on)].filter(Boolean).join(' · ') || 'Add a destination and dates'}
        </Text>
        {trip.owner_id && trip.owner_name ? (
          <Text style={{ color: '#ffffffcc', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            Shared by {trip.owner_name}
          </Text>
        ) : null}
        {trip.budget_total ? <BudgetBar compact spent={spentAmount} budget={trip.budget_total} currency={trip.currency || 'INR'} /> : null}
      </TripCover>
      <View style={{ padding: 14, paddingTop: 10 }}>
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }} numberOfLines={2}>
          {synopsis}
        </Text>
        {packingRatio > 0 && trip.status !== 'completed' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Icon name="bag-checked" size={16} color={colors.secondary} />
            <Meter progress={packingRatio} color={colors.secondary} height={6} style={{ flex: 1 }} />
            <Text style={{ fontSize: 12, color: colors.muted }}>{Math.round(packingRatio * 100)}%</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
