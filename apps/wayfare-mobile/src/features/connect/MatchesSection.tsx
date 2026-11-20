import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Switch, Text } from 'react-native-paper';
import { UserRow } from '../../components/UserRow';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDateRange, tripPhase } from '../../lib/format';
import { journeysOnly } from '../../lib/everydayMemories';
import { listTrips, updateTrip, type LocalTrip } from '../../lib/localDb';
import { placeLabel } from '../../lib/places';
import { pushTripNow } from '../../lib/sync';
import { startDirect } from '../../social/chat';
import { findTripMatches } from '../../social/connect';
import type { TripMatch } from '../../social/types';
import { useAppTheme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { Notice } from '../../ui/Notice';

type Row = { trip: LocalTrip; matches: TripMatch[] | null; error: string | null };

export function MatchesSection() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    const trips = journeysOnly(await listTrips()).filter(t => t.status !== 'completed' && tripPhase(t.starts_on, t.ends_on) !== 'past');
    const out: Row[] = [];
    for (const trip of trips) {
      if (!trip.open_to_meet) {
        out.push({ trip, matches: null, error: null });
        continue;
      }
      try {
        if (user && trip.sync_status === 'pending') await pushTripNow(user.id, trip.id);
        out.push({ trip, matches: await findTripMatches(trip.id), error: null });
      } catch (e) {
        out.push({ trip, matches: null, error: e instanceof Error ? e.message : 'Could not load matches' });
      }
    }
    setRows(out);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const open = async (trip: LocalTrip) => {
    await updateTrip(trip.id, { open_to_meet: 1 });
    if (user) await pushTripNow(user.id, trip.id).catch(() => toast('Saved — matching starts when you are online.'));
    load();
  };

  const sayHi = async (id: string) => {
    try {
      router.push(`/chat/${await startDirect(id)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start chat');
    }
  };

  if (rows === null) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 60 }}>
      <Text style={{ color: colors.muted, marginBottom: 12, lineHeight: 20 }}>
        Who is heading where you are going, around your dates. Only trips marked “open to meet” take part — on both sides.
      </Text>
      {!rows.length ? (
        <EmptyState icon="calendar-account-outline" title="No upcoming journeys" body="Plan a trip with a destination and dates to find travellers on the same path." action="Plan a journey" onAction={() => router.push('/trip/new')} />
      ) : null}
      {rows.map(({ trip, matches, error }) => (
        <View key={trip.id} style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800' }} onPress={() => router.push(`/trip/${trip.id}`)}>
                {trip.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {[placeLabel(trip.place_key, trip.destination), formatDateRange(trip.starts_on, trip.ends_on)].filter(Boolean).join(' · ') || 'Add destination & dates'}
              </Text>
            </View>
            <Switch value={trip.open_to_meet === 1} onValueChange={v => (v ? open(trip) : updateTrip(trip.id, { open_to_meet: 0 }).then(load))} />
          </View>
          {error ? <Notice tone="warning" text={error} /> : null}
          {trip.open_to_meet && (!trip.place_key || !trip.starts_on) ? (
            <Notice tone="info" text="Add a destination and start date to this journey to get matches." />
          ) : null}
          {matches?.length ? (
            matches.map(m => (
              <UserRow
                key={m.user_id}
                id={m.user_id}
                username={m.username}
                name={m.display_name}
                avatarPath={m.avatar_path}
                tier={m.tier}
                subtitle={`${formatDateRange(m.starts_on, m.ends_on)}${m.overlap_days ? ` · ${m.overlap_days}d overlap` : ''}`}
                right={<Button compact mode="contained-tonal" onPress={() => sayHi(m.user_id)}>Say hi</Button>}
              />
            ))
          ) : trip.open_to_meet && matches ? (
            <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13 }}>No one yet — we will notify you when someone matches.</Text>
          ) : !trip.open_to_meet ? (
            <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13 }}>Switch on to see who else is going.</Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
