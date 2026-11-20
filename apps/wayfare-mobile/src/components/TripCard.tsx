import { TripCover } from '../ui/TripCover';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ProgressBar, Text } from 'react-native-paper';
import { getDestination } from '../content/destinations';
import { daysUntil, formatDateRange, tripPhase } from '../lib/format';
import type { LocalTrip } from '../lib/localDb';
import { useAppTheme } from '../theme';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';

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

const TYPE_GRADIENTS: Record<string, [string, string]> = {
  trek: ['#0f766e', '#134e4a'],
  road: ['#c2410c', '#7c2d12'],
  city: ['#4338ca', '#1e1b4b'],
  beach: ['#0284c7', '#0c4a6e'],
  backpacking: ['#a16207', '#422006'],
  pilgrimage: ['#b45309', '#451a03'],
  wildlife: ['#15803d', '#052e16'],
  international: ['#7c3aed', '#2e1065'],
};

export function tripTypeIcon(type: string) {
  return TYPE_ICONS[type] ?? 'map-outline';
}

type Props = { trip: LocalTrip; synopsis: string; packingRatio: number; tracking?: boolean; spent?: string };

export function TripCard({ trip, synopsis, packingRatio, tracking, spent }: Props) {
  const { colors } = useAppTheme();
  const phase = tripPhase(trip.starts_on, trip.ends_on);
  const until = daysUntil(trip.starts_on);
  const dest = getDestination(trip.place_key);
  const gradient = TYPE_GRADIENTS[trip.trip_type] ?? ['#57534e', '#1c1917'];
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
      <TripCover uri={trip.cover_uri} gradient={gradient} spent={spent} style={{ padding: 16, minHeight: trip.cover_uri ? 150 : 104 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={tripTypeIcon(trip.trip_type)} size={18} color="#fff" />
          <Text style={{ color: '#ffffffcc', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, flex: 1 }}>
            {phaseLabel.toUpperCase()}
          </Text>
          {tracking ? <Pill icon="record-circle" label="Recording" color="#fff" background="#dc2626" /> : null}
          {trip.open_to_meet ? <Icon name="account-group" size={18} color="#fff" /> : null}
          {trip.sync_status === 'pending' ? <Icon name="cloud-upload-outline" size={16} color="#ffffffaa" /> : null}
        </View>
        <Text variant="titleLarge" style={{ color: '#fff', fontWeight: '800', marginTop: 10 }} numberOfLines={2}>
          {trip.title}
        </Text>
        <Text style={{ color: '#ffffffd9', marginTop: 2 }} numberOfLines={1}>
          {[dest?.name ?? trip.destination, formatDateRange(trip.starts_on, trip.ends_on)].filter(Boolean).join(' · ') || 'Add a destination and dates'}
        </Text>
      </TripCover>
      <View style={{ padding: 14, paddingTop: 10 }}>
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }} numberOfLines={2}>
          {synopsis}
        </Text>
        {packingRatio > 0 && trip.status !== 'completed' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Icon name="bag-checked" size={16} color={colors.secondary} />
            <ProgressBar progress={packingRatio} color={colors.secondary} style={{ height: 6, borderRadius: 3, flex: 1 }} />
            <Text style={{ fontSize: 12, color: colors.muted }}>{Math.round(packingRatio * 100)}%</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
