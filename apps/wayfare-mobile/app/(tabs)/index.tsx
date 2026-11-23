import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { IconButton, Menu, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TripCard } from '../../src/components/TripCard';
import { useAuth } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import { daysUntil, timeAgo, tripPhase } from '../../src/lib/format';
import { journeysOnly } from '../../src/lib/everydayMemories';
import { listTrips, type LocalTrip } from '../../src/lib/localDb';
import { getActiveTrackingTripId } from '../../src/lib/locationTask';
import { buildTripSynopsis, computeTripStats } from '../../src/lib/tripStats';
import { getRates } from '../../src/lib/currency';
import { backupLabel, backupState } from '../../src/lib/backupStatus';
import { splitSpend, type MoneyAmount } from '../../src/lib/currencyMath';
import { tripCoverUri } from '../../src/lib/tripCover';
import { applyTripFilter, pickNextUp, type TripFilter } from '../../src/lib/tripList';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/Icon';
import { Pill } from '../../src/ui/Pill';
import { TripCover } from '../../src/ui/TripCover';
import { SOCIAL_ENABLED } from '../../src/lib/features';
import { Glass } from '../../src/ui/Glass';
import { TAB_BAR_SPACE } from '../../src/ui/GlassTabBar';

type TripRow = LocalTrip & { synopsis: string; packingRatio: number; spentAmount: number; unconverted: MoneyAmount[]; cover: string | null };

/** Journeys are prepared (stats, money, cover) a few at a time as you scroll, not all at once. */
const PAGE_SIZE = 5;

const FILTER_LABEL: Record<TripFilter, string> = { all: 'All journeys', upcoming: 'Upcoming', past: 'Past' };

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Stats, spend in the journey's currency and the cover picture, for the cards being shown. */
async function prepare(list: LocalTrip[]): Promise<TripRow[]> {
  const rates = await getRates().catch(() => null);
  return Promise.all(
    list.map(async t => {
      const stats = await computeTripStats(t.id);
      const spend = splitSpend(stats.spendByCurrency, t.currency || 'INR', rates?.rates ?? null);
      return {
        ...t,
        synopsis: buildTripSynopsis(t.title, stats),
        packingRatio: stats.packingTotal ? stats.packingDone / stats.packingTotal : 0,
        spentAmount: spend.total,
        unconverted: spend.pending,
        cover: await tripCoverUri(t).catch(() => null),
      };
    })
  );
}

export default function JourneysTab() {
  const { colors } = useAppTheme();
  const { user, profile, guest, offlineMode, journalReady } = useAuth();
  const { syncing, syncNow, pending, lastSyncAt, lastErrors, refreshPending } = useSync();
  // Every journey's basic details (cheap), and the prepared cards shown so far (a page at a time).
  const [all, setAll] = useState<LocalTrip[]>([]);
  const [rows, setRows] = useState<TripRow[]>([]);
  const [nextUp, setNextUp] = useState<TripRow | null>(null);
  const [filter, setFilter] = useState<TripFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [recordingTripId, setRecordingTripId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // The backup status shows only after you tap the cloud, then fades away.
  const [showStatus, setShowStatus] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const shown = useRef(PAGE_SIZE);
  const insets = useSafeAreaInsets();

  const load = useCallback(
    async (f: TripFilter = filter) => {
      const list = journeysOnly(await listTrips());
      const top = pickNextUp(list);
      const rest = applyTripFilter(list, f, top?.id ?? null);
      // Keep as many cards as were already on screen, at least one page.
      const count = Math.max(PAGE_SIZE, Math.min(shown.current, rest.length));
      const [page, topRow] = await Promise.all([prepare(rest.slice(0, count)), top ? prepare([top]) : Promise.resolve([])]);
      shown.current = count;
      setAll(list);
      setRows(page);
      setNextUp(topRow[0] ?? null);
      setRecordingTripId(await getActiveTrackingTripId());
      setLoaded(true);
      refreshPending();
    },
    [filter, refreshPending]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Reload when the journal is ready and whenever a sync finishes, so every trip shows at once.
  useEffect(() => {
    load();
  }, [load, lastSyncAt, journalReady]);

  const rest = useMemo(() => applyTripFilter(all, filter, nextUp?.id ?? null), [all, filter, nextUp]);
  const hasMore = rows.length < rest.length;

  /** The next page of cards, with a spinner while they're prepared. */
  const loadMore = async () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const more = await prepare(rest.slice(rows.length, rows.length + PAGE_SIZE));
      setRows(prev => {
        const seen = new Set(prev.map(r => r.id));
        const next = [...prev, ...more.filter(r => !seen.has(r.id))];
        shown.current = next.length;
        return next;
      });
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  };

  const chooseFilter = (f: TripFilter) => {
    setFilterOpen(false);
    shown.current = PAGE_SIZE;
    setFilter(f);
  };

  /** Pull to refresh: reload the list from this phone. Backing up happens only from the cloud button. */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  /** The cloud button: back up now and show how it went for a few seconds. */
  const backUp = async () => {
    setShowStatus(true);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    if (user) await syncNow();
    await load();
    statusTimer.current = setTimeout(() => setShowStatus(false), 6000);
  };
  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);

  const recordingTrip = all.find(t => t.id === recordingTripId);
  const firstName = (profile?.display_name ?? '').split(' ')[0];

  const backup = { syncing, errors: lastErrors, pending, lastSyncAt };
  const syncLine = offlineMode
    ? 'Offline journal mode'
    : guest || !user
      ? 'Journal saved on this phone · sign up to back it up'
      : backupState(backup) === 'verified' && lastSyncAt
        ? `Backed up ${timeAgo(lastSyncAt)}`
        : backupLabel(backup);

  const days = nextUp ? daysUntil(nextUp.starts_on) : null;

  const header = (
    <View style={{ paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text variant="headlineSmall" style={{ fontWeight: '800' }} numberOfLines={1}>
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          {/* Shown after tapping the cloud, or when something needs your attention. */}
          {showStatus || syncing || lastErrors.length || guest || !user ? (
            <Pressable onPress={guest || !user ? () => router.push('/register') : backUp} accessibilityRole="button">
              <Text style={{ color: lastErrors.length ? colors.error : colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                {syncLine}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {user ? (
          <IconButton icon={syncing ? 'cloud-sync' : 'cloud-sync-outline'} onPress={backUp} disabled={syncing} accessibilityLabel="Back up now" />
        ) : null}
        <IconButton icon="shield-alert-outline" iconColor={colors.danger} onPress={() => router.push('/safety')} accessibilityLabel="Safety and SOS" />
      </View>

      {/* The journey filter, on its own at the right. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
        {all.length > 1 ? (
          <Menu
            visible={filterOpen}
            onDismiss={() => setFilterOpen(false)}
            anchor={
              <IconButton
                icon={filter === 'all' ? 'filter-variant' : 'filter-check'}
                size={20}
                mode={filter === 'all' ? undefined : 'contained-tonal'}
                iconColor={filter === 'all' ? colors.onSurfaceVariant : colors.primary}
                style={{ margin: 0 }}
                onPress={() => setFilterOpen(true)}
                accessibilityLabel={`Filter journeys: ${FILTER_LABEL[filter]}`}
              />
            }
          >
            {(['all', 'upcoming', 'past'] as TripFilter[]).map(f => (
              <Menu.Item
                key={f}
                title={FILTER_LABEL[f]}
                leadingIcon={filter === f ? 'check' : undefined}
                onPress={() => chooseFilter(f)}
              />
            ))}
          </Menu>
        ) : null}
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
          {/* The journey on the road or next up, on its cover photo like every other card. */}
          <TripCover
            uri={nextUp.cover}
            gradient={[colors.heroStart, colors.heroEnd]}
            style={{ borderRadius: 22, padding: 18, minHeight: nextUp.cover ? 180 : undefined, justifyContent: 'flex-end' }}
          >
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
              {days != null && days > 0 ? (
                <View style={{ alignItems: 'center', marginLeft: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', lineHeight: 38 }}>{days}</Text>
                  <Text style={{ color: '#ffffffcc', fontSize: 11 }}>day{days === 1 ? '' : 's'} to go</Text>
                </View>
              ) : null}
            </View>
            {SOCIAL_ENABLED && nextUp.open_to_meet ? (
              <View style={{ marginTop: 10 }}>
                <Pill icon="account-group" label="Open to meet travellers" color="#fff" background="#ffffff2e" />
              </View>
            ) : null}
          </TripCover>
        </Pressable>
      ) : null}

      {filter !== 'all' ? (
        <Text style={{ color: colors.muted, marginTop: 14, fontWeight: '600' }}>{FILTER_LABEL[filter]}</Text>
      ) : null}
      <View style={{ height: 10 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={rows}
        keyExtractor={t => t.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        contentContainerStyle={{ padding: 16, paddingBottom: TAB_BAR_SPACE + 80 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore || hasMore ? (
            <View style={{ paddingVertical: 18, alignItems: 'center' }} accessibilityLabel="Loading more journeys">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loaded ? (
            all.length ? (
              nextUp && filter === 'all' ? null : <EmptyState compact icon="filter-outline" title="Nothing here" body="No journeys match this filter." />
            ) : (
              <EmptyState
                icon="map-marker-path"
                title="Where to next?"
                body="Start a journey to journal moments offline, plan each day, split costs and add your crew."
                action="Start a journey"
                onAction={() => router.push('/trip/new')}
                secondary={SOCIAL_ENABLED ? 'Explore destinations' : undefined}
                onSecondary={SOCIAL_ENABLED ? () => router.push('/(tabs)/discover') : undefined}
              />
            )
          ) : (
            <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
          )
        }
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            synopsis={item.synopsis}
            packingRatio={item.packingRatio}
            tracking={item.id === recordingTripId}
            spentAmount={item.spentAmount}
            unconverted={item.unconverted}
            coverUri={item.cover}
            showUpload={Boolean(user)}
          />
        )}
      />
      {/* New journey: a brand-coloured glass button floating above the tab bar (the empty screen has its own button). */}
      {loaded && !all.length ? null : (
      <Pressable
        onPress={() => router.push('/trip/new')}
        accessibilityRole="button"
        accessibilityLabel="Start a new journey"
        style={({ pressed }) => ({ position: 'absolute', right: 18, bottom: Math.max(insets.bottom, 10) + 84, transform: [{ scale: pressed ? 0.94 : 1 }] })}
      >
        <Glass
          tint={colors.primary}
          interactive
          radius={30}
          style={{ height: 60, minWidth: 60, paddingHorizontal: all.length ? 0 : 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
        >
          <Icon name="plus" size={28} color={colors.onPrimary} />
          {all.length ? null : <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 16 }}>New journey</Text>}
        </Glass>
      </Pressable>
      )}
    </View>
  );
}
