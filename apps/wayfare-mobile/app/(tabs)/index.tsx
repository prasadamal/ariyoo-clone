import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { FAB, IconButton, SegmentedButtons, Text } from 'react-native-paper';
import { TripCard } from '../../src/components/TripCard';
import { useAuth } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import { daysUntil, timeAgo, tripPhase } from '../../src/lib/format';
import { isEverydayTrip, journeysOnly, onThisDay, wroteToday, yearsAgoLabel, type MemoryGroup } from '../../src/lib/everydayMemories';
import { listAllEntries, listTrips, type LocalEntry, type LocalTrip } from '../../src/lib/localDb';
import { getActiveTrackingTripId } from '../../src/lib/locationTask';
import { buildTripSynopsis, computeTripStats } from '../../src/lib/tripStats';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Hero } from '../../src/ui/Hero';
import { Icon } from '../../src/ui/Icon';
import { Pill } from '../../src/ui/Pill';

type TripRow = LocalTrip & { synopsis: string; packingRatio: number };
type Filter = 'all' | 'upcoming' | 'past';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function JourneysTab() {
  const { colors } = useAppTheme();
  const { user, profile, guest, offlineMode } = useAuth();
  const { syncing, syncNow, pending, lastSyncAt, lastErrors, refreshPending } = useSync();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [recordingTripId, setRecordingTripId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [wroteTodayPage, setWroteTodayPage] = useState(false);
  const [memories, setMemories] = useState<MemoryGroup<LocalEntry>[]>([]);
  const [journalNames, setJournalNames] = useState<Record<string, { title: string; everyday: boolean }>>({});

  const load = useCallback(async () => {
    const [all, entries] = await Promise.all([listTrips(), listAllEntries()]);
    const raw = journeysOnly(all);
    const today = new Date();
    const everydayIds = new Set(all.filter(isEverydayTrip).map(t => t.id));
    setWroteTodayPage(wroteToday(entries.filter(e => everydayIds.has(e.trip_id)), today));
    setMemories(onThisDay(entries, today));
    setJournalNames(Object.fromEntries(all.map(t => [t.id, { title: isEverydayTrip(t) ? 'Everyday journal' : t.title, everyday: isEverydayTrip(t) }])));
    const enriched = await Promise.all(
      raw.map(async t => {
        const stats = await computeTripStats(t.id);
        return {
          ...t,
          synopsis: buildTripSynopsis(t.title, stats),
          packingRatio: stats.packingTotal ? stats.packingDone / stats.packingTotal : 0,
        };
      })
    );
    setTrips(enriched);
    setRecordingTripId(await getActiveTrackingTripId());
    setLoaded(true);
    refreshPending();
  }, [refreshPending]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    if (user) await syncNow();
    await load();
  };

  const nextUp = useMemo(() => {
    const upcoming = trips
      .filter(t => t.status !== 'completed' && ['upcoming', 'ongoing'].includes(tripPhase(t.starts_on, t.ends_on)))
      .sort((a, b) => (a.starts_on ?? '').localeCompare(b.starts_on ?? ''));
    return upcoming[0] ?? null;
  }, [trips]);

  const visible = useMemo(() => {
    if (filter === 'all') return trips;
    return trips.filter(t => {
      const phase = tripPhase(t.starts_on, t.ends_on);
      if (filter === 'upcoming') return t.status !== 'completed' && phase !== 'past';
      return t.status === 'completed' || phase === 'past';
    });
  }, [trips, filter]);

  const recordingTrip = trips.find(t => t.id === recordingTripId);
  const firstName = (profile?.display_name ?? '').split(' ')[0];

  const syncLine = offlineMode
    ? 'Offline journal mode'
    : guest || !user
      ? 'Journal saved on this phone · sign up to back it up'
      : syncing
        ? 'Syncing…'
        : lastErrors.length
          ? `Sync issue: ${lastErrors[0]}`
          : pending
            ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync`
            : lastSyncAt
              ? `Backed up ${timeAgo(lastSyncAt)}`
              : 'Backup has not been verified yet';

  const header = (
    <View style={{ paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text variant="headlineSmall" style={{ fontWeight: '800' }}>
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          <Pressable onPress={guest || !user ? () => router.push('/register') : onRefresh} accessibilityRole="button">
            <Text style={{ color: lastErrors.length ? colors.error : colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
              {syncLine}
            </Text>
          </Pressable>
        </View>
        {user ? (
          <IconButton icon={syncing ? 'cloud-sync' : 'cloud-sync-outline'} onPress={onRefresh} disabled={syncing} accessibilityLabel="Sync now" />
        ) : null}
        <IconButton icon="shield-alert-outline" iconColor={colors.danger} onPress={() => router.push('/safety')} accessibilityLabel="Safety and SOS" />
      </View>

      {recordingTrip ? (
        <Pressable onPress={() => router.push(`/trip/${recordingTrip.id}`)} accessibilityRole="button">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.errorContainer, padding: 10, borderRadius: 12, marginTop: 10 }}>
            <Icon name="record-circle" size={18} color={colors.danger} />
            <Text style={{ flex: 1, color: colors.onErrorContainer, fontWeight: '600' }} numberOfLines={1}>
              Recording route · {recordingTrip.title}
            </Text>
            <Icon name="chevron-right" size={18} color={colors.onErrorContainer} />
          </View>
        </Pressable>
      ) : null}

      {nextUp ? (
        <Pressable onPress={() => router.push(`/trip/${nextUp.id}`)} accessibilityRole="button" style={{ marginTop: 14 }}>
          <Hero variant="glacier">
            <Text style={{ color: '#ffffffcc', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
              {tripPhase(nextUp.starts_on, nextUp.ends_on) === 'ongoing' ? 'ON THE ROAD' : 'NEXT UP'}
            </Text>
            <Text variant="titleLarge" style={{ color: '#fff', fontWeight: '800', marginTop: 4 }} numberOfLines={1}>
              {nextUp.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffffd9' }} numberOfLines={2}>
                  {nextUp.synopsis}
                </Text>
              </View>
              {(() => {
                const d = daysUntil(nextUp.starts_on);
                return d != null && d > 0 ? (
                  <View style={{ alignItems: 'center', marginLeft: 12 }}>
                    <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', lineHeight: 38 }}>{d}</Text>
                    <Text style={{ color: '#ffffffcc', fontSize: 11 }}>day{d === 1 ? '' : 's'} to go</Text>
                  </View>
                ) : null;
              })()}
            </View>
            {nextUp.open_to_meet ? (
              <View style={{ marginTop: 10 }}>
                <Pill icon="account-group" label="Open to meet travellers" color="#fff" background="#ffffff2e" />
              </View>
            ) : null}
          </Hero>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => router.push('/journal')}
        accessibilityRole="button"
        accessibilityLabel={wroteTodayPage ? 'Today\'s page is written. Open your everyday journal to add more' : 'Write today\'s page in your everyday journal'}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginTop: 14,
          padding: 14,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
        })}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={wroteTodayPage ? 'check' : 'feather'} size={22} color={colors.onSecondaryContainer} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>{wroteTodayPage ? 'Today\'s page is written' : 'How was today?'}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
            {wroteTodayPage ? 'Add another moment, photo or voice note.' : 'A private everyday journal, even when you are not travelling.'}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color={colors.muted} />
      </Pressable>

      {memories.length ? (
        <View style={{ marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: colors.primaryContainer }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="calendar-heart" size={18} color={colors.onPrimaryContainer} />
            <Text accessibilityRole="header" style={{ color: colors.onPrimaryContainer, fontWeight: '800', fontSize: 15 }}>
              On this day
            </Text>
          </View>
          {memories.slice(0, 3).map(group => {
            const first = group.entries[0];
            const from = journalNames[first.trip_id];
            const more = group.entries.length - 1;
            return (
              <Pressable
                key={group.year}
                onPress={() => router.push(from?.everyday || !from ? '/journal' : `/trip/${first.trip_id}`)}
                accessibilityRole="button"
                style={{ marginTop: 10 }}
              >
                <Text style={{ color: colors.onPrimaryContainer, fontSize: 12, fontWeight: '700', opacity: 0.85 }} numberOfLines={1}>
                  {yearsAgoLabel(group.yearsAgo).toUpperCase()} · {from?.title ?? 'Journal'}
                </Text>
                <Text style={{ color: colors.onPrimaryContainer, marginTop: 2, lineHeight: 21 }} numberOfLines={3}>
                  {first.mood ? `${first.mood} ` : ''}
                  {first.body?.trim() || first.place_name || 'A moment with photos or a voice note'}
                </Text>
                {more > 0 ? (
                  <Text style={{ color: colors.onPrimaryContainer, fontSize: 12, marginTop: 2, opacity: 0.85 }}>
                    +{more} more moment{more === 1 ? '' : 's'} that day
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Pill icon="party-popper" label="Year in travel" onPress={() => router.push('/wrapped')} />
        <Pill icon="medal-outline" label="Badges" onPress={() => router.push('/badges')} />
        <Pill icon="swap-horizontal" label="Currency" onPress={() => router.push('/tools/currency')} />
        <Pill icon="shield-check-outline" label="Safety" onPress={() => router.push('/safety')} />
      </View>

      {trips.length ? (
        <SegmentedButtons
          value={filter}
          onValueChange={v => setFilter(v as Filter)}
          style={{ marginTop: 16, marginBottom: 6 }}
          buttons={[
            { value: 'all', label: `All (${trips.length})` },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
        />
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={visible}
        keyExtractor={t => t.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        ListEmptyComponent={
          loaded ? (
            trips.length ? (
              <EmptyState compact icon="filter-outline" title="Nothing here" body="No journeys match this filter." />
            ) : (
              <EmptyState
                icon="map-marker-path"
                title="Where to next?"
                body="Start a journey to journal moments offline, plan each day, split costs with friends and find travellers heading the same way."
                action="Start a journey"
                onAction={() => router.push('/trip/new')}
                secondary="Explore destinations"
                onSecondary={() => router.push('/(tabs)/discover')}
              />
            )
          ) : null
        }
        renderItem={({ item }) => (
          <TripCard trip={item} synopsis={item.synopsis} packingRatio={item.packingRatio} tracking={item.id === recordingTripId} />
        )}
      />
      <FAB
        icon="plus"
        label={trips.length ? undefined : 'New journey'}
        style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.primary }}
        color={colors.onPrimary}
        onPress={() => router.push('/trip/new')}
        accessibilityLabel="Start a new journey"
      />
    </View>
  );
}

