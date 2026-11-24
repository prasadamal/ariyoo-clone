import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { getDestination } from '../content/destinations';
import { SOCIAL_ENABLED } from '../lib/features';
import { daysUntil, formatDateRange } from '../lib/format';
import type { LocalTrip } from '../lib/localDb';
import { tripStatus, type TripStatus } from '../lib/tripList';
import { useAppTheme } from '../theme';
import { coverArtFor } from '../ui/coverArt';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { TripCover } from '../ui/TripCover';

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

// One quiet style for every status: smoked glass, white text, and a small coloured dot.
const STATUS: Record<TripStatus, { label: string; dot: string }> = {
  ongoing: { label: 'On Going', dot: '#4ade80' },
  upcoming: { label: 'Coming Soon', dot: '#d8b4fe' },
  completed: { label: 'Completed', dot: '#e5e7eb' },
};

/** The status chip in a tile's top-left corner; with a count when the tile stands for a group. */
function StatusChip({ status, count }: { status: TripStatus; count?: number }) {
  const s = STATUS[status];
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: StyleSheet.hairlineWidth, borderColor: '#ffffff55' }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.dot }} />
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12, letterSpacing: 0.3 }}>{s.label}</Text>
      {count && count > 1 ? (
        <Text style={{ color: '#ffffffb3', fontWeight: '600', fontSize: 12 }}>· {count}</Text>
      ) : null}
    </View>
  );
}

/** coverUri: the cover to show (your chosen photo, or the newest moment photo); else an illustration. */
type Props = {
  trip: LocalTrip;
  synopsis: string;
  tracking?: boolean;
  coverUri?: string | null;
  showUpload?: boolean;
  /** Featured tiles on top of Journeys are a little taller. */
  large?: boolean;
  /** How many journeys this tile stands for (the newest is shown); more than one draws a stack behind it. */
  groupCount?: number;
  /** What a tap does (default: open the journey). A group tile opens its list instead. */
  onPress?: () => void;
  /** Tile height (the three tiles on Journeys share the screen). */
  height?: number;
};

/**
 * A journey tile: its cover photo (or an illustration for its type) with a status chip, the title
 * and a line or two of details; upcoming and ongoing journeys show the day count on the right.
 */
export function TripCard({ trip, synopsis, tracking, coverUri, showUpload = true, large = false, groupCount, onPress, height }: Props) {
  const cover = coverUri === undefined ? trip.cover_uri : coverUri;
  const { colors } = useAppTheme();
  const status = tripStatus(trip);
  const dest = getDestination(trip.place_key);
  const until = daysUntil(trip.starts_on);
  const dayOf = trip.starts_on ? -(until ?? 0) + 1 : null;
  const totalDays = trip.starts_on && trip.ends_on ? (daysUntil(trip.ends_on) ?? 0) - (until ?? 0) + 1 : null;
  const big =
    status === 'upcoming' && until != null && until > 0
      ? { value: String(until), caption: `day${until === 1 ? '' : 's'} to go` }
      : status === 'ongoing' && dayOf
        ? { value: `Day ${dayOf}`, caption: totalDays ? `of ${totalDays}` : 'on the road' }
        : status === 'completed' && totalDays && totalDays > 0
          ? { value: String(totalDays), caption: 'day trip' }
          : null;
  const details = synopsis || [dest?.name ?? trip.destination, formatDateRange(trip.starts_on, trip.ends_on)].filter(Boolean).join(' · ') || 'Add a destination and dates';
  const stacked = (groupCount ?? 0) > 1;
  const card = (
    <Pressable
      onPress={onPress ?? (() => router.push(`/trip/${trip.id}`))}
      style={({ pressed }) => ({ marginBottom: stacked ? 0 : 14, borderRadius: 22, overflow: 'hidden', opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
      accessibilityRole="button"
      accessibilityLabel={`${trip.title}, ${STATUS[status].label}${stacked ? `, newest of ${groupCount}` : ''}`}
    >
      <TripCover uri={cover} art={coverArtFor(trip.trip_type)} gradient={[colors.heroStart, colors.heroEnd]} style={{ borderRadius: 22, padding: 18, minHeight: height ?? (large ? 190 : 160), justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StatusChip status={status} count={groupCount} />
          <View style={{ flex: 1 }} />
          {tracking ? <Pill icon="record-circle" label="Recording" color="#fff" background="#dc2626" /> : null}
          {SOCIAL_ENABLED && trip.open_to_meet ? <Icon name="account-group" size={18} color="#fff" /> : null}
          {(trip.crew_count ?? 0) > 1 ? (
            <View accessibilityLabel={`Shared with ${trip.crew_count} people`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name="account-multiple" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{trip.crew_count}</Text>
            </View>
          ) : null}
          {showUpload && trip.sync_status === 'pending' ? <Icon name="cloud-upload-outline" size={16} color="#ffffffaa" /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 18 }}>
          <View style={{ flex: 1 }}>
            {/* A sized tile (the three on Journeys) keeps to one line each, so all three fit the screen. */}
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: large ? 28 : 24, letterSpacing: -0.3 }} numberOfLines={height ? 1 : 2} adjustsFontSizeToFit={Boolean(height)} minimumFontScale={0.75}>
              {trip.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Icon name="calendar-month-outline" size={16} color="#ffffffd9" />
              <Text style={{ color: '#ffffffe6', flexShrink: 1 }} numberOfLines={height ? 1 : 2}>
                {details}
              </Text>
            </View>
            {trip.owner_id && trip.owner_name ? (
              <Text style={{ color: '#ffffffcc', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                Shared by {trip.owner_name}
              </Text>
            ) : null}
          </View>
          {big ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
              <View style={{ width: 1.5, alignSelf: 'stretch', backgroundColor: '#ffffffb0', marginRight: 12 }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: big.value.length > 3 ? 24 : 34, fontWeight: '900', lineHeight: 38 }}>{big.value}</Text>
                <Text style={{ color: '#ffffffd9', fontSize: 12 }}>{big.caption}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </TripCover>
    </Pressable>
  );
  if (!stacked) return card;
  // A group: two cards peek out underneath, like a small deck of journeys.
  return (
    <View style={{ marginBottom: 30 }}>
      {/* Drawn first so they sit behind the tile. */}
      <View style={{ position: 'absolute', left: 28, right: 28, bottom: -14, height: 40, borderRadius: 18, backgroundColor: colors.onSurface, opacity: 0.07 }} />
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: -7, height: 40, borderRadius: 20, backgroundColor: colors.onSurface, opacity: 0.14 }} />
      {card}
    </View>
  );
}
