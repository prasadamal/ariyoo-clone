import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnThisDayCard } from '../../src/components/OnThisDayCard';
import { TripCard } from '../../src/components/TripCard';
import { useAuth } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import { timeAgoPhrase } from '../../src/lib/format';
import { journeysOnly } from '../../src/lib/everydayMemories';
import { listTrips, type LocalTrip } from '../../src/lib/localDb';
import { getActiveTrackingTripId } from '../../src/lib/locationTask';
import { buildTripSynopsis, computeTripStats } from '../../src/lib/tripStats';
import { getRates } from '../../src/lib/currency';
import { backupLabel, backupState } from '../../src/lib/backupStatus';
import { splitSpend, type MoneyAmount } from '../../src/lib/currencyMath';
import { tripCoverUri } from '../../src/lib/tripCover';
import { featuredTrips, recentFirst, statusCounts, tripStatus, type TripStatus } from '../../src/lib/tripList';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/Icon';
import { Pill } from '../../src/ui/Pill';
import { SOCIAL_ENABLED } from '../../src/lib/features';
import { Glass } from '../../src/ui/Glass';
import { TAB_BAR_SPACE } from '../../src/ui/GlassTabBar';

type TripRow = LocalTrip & { synopsis: string; packingRatio: number; spentAmount: number; unconverted: MoneyAmount[]; cover: string | null };

/** Journeys are prepared (stats, money, cover) a few at a time as you scroll, not all at once. */
const PAGE_SIZE = 5;


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
      const stats = await computeTripStats(t.id, t);
      const spend = splitSpend(stats.spendByCurrency, t.currency || 'INR', rates?.rates ?? null);
      return {
        ...t,
        synopsis: buildTripSynopsis(t.title, stats, tripStatus(t) === 'completed'),
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
  // Every journey's basic details (cheap); the three featured tiles; the full list, a page at a time.
  const [all, setAll] = useState<LocalTrip[]>([]);
  const [rows, setRows] = useState<TripRow[]>([]);
  const [featured, setFeatured] = useState<TripRow[]>([]);
  const [counts, setCounts] = useState<Record<TripStatus, number>>({ ongoing: 0, upcoming: 0, completed: 0 });
  // Where the full list starts, and whether you've scrolled into it (the floating pill then says "Top").
  const [listTop, setListTop] = useState(0);
  const [inList, setInList] = useState(false);
  const [recordingTripId, setRecordingTripId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // The backup status shows only after you tap the cloud, then fades away.
  const [showStatus, setShowStatus] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const shown = useRef(PAGE_SIZE);
  const listRef = useRef<FlatList<TripRow>>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const load = useCallback(async () => {
    const list = journeysOnly(await listTrips());
    const f = featuredTrips(list);
    const top = [f.ongoing, f.upcoming, f.completed].filter((t): t is LocalTrip => Boolean(t));
    const sorted = recentFirst(list);
    // Keep as many cards as were already on screen, at least one page.
    const count = Math.max(PAGE_SIZE, Math.min(shown.current, sorted.length));
    const [page, topRows] = await Promise.all([prepare(sorted.slice(0, count)), prepare(top)]);
    shown.current = count;
    setAll(list);
    setRows(page);
    setFeatured(topRows);
    setCounts(statusCounts(list));
    setRecordingTripId(await getActiveTrackingTripId());
    setLoaded(true);
    refreshPending();
  }, [refreshPending]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Reload when the journal is ready and whenever a sync finishes, so every trip shows at once.
  useEffect(() => {
    load();
  }, [load, lastSyncAt, journalReady]);

  const sortedAll = useMemo(() => recentFirst(all), [all]);
  const hasMore = rows.length < sortedAll.length;

  /** The next page of cards, with a spinner while they're prepared. */
  const loadMore = async () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const more = await prepare(sortedAll.slice(rows.length, rows.length + PAGE_SIZE));
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

  // Backup, search and SOS sit in the bar next to the logo, so your name has the whole line.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
          {user ? (
            <IconButton icon={syncing ? 'cloud-sync' : 'cloud-sync-outline'} onPress={backUp} disabled={syncing} accessibilityLabel="Back up now" />
          ) : null}
          <IconButton icon="magnify" onPress={() => router.push('/find' as never)} accessibilityLabel="Search your journal" />
          <IconButton icon="shield-alert-outline" iconColor={colors.danger} onPress={() => router.push('/safety')} accessibilityLabel="Safety and SOS" />
        </View>
      ),
    });
  });

  const recordingTrip = all.find(t => t.id === recordingTripId);
  const firstName = (profile?.display_name ?? '').split(' ')[0];

  const backup = { syncing, errors: lastErrors, pending, lastSyncAt };
  const syncLine = offlineMode
    ? 'Offline journal mode'
    : guest || !user
      ? 'Journal saved on this phone · sign up to back it up'
      : backupState(backup) === 'verified' && lastSyncAt
        ? `Backed up ${timeAgoPhrase(lastSyncAt)}`
        : backupLabel(backup);

  const showList = all.length > featured.length || all.length > 1;
  const fabBottom = Math.max(insets.bottom, 10) + 84;

  const header = (
    <View style={{ paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          {firstName ? (
            <>
              <Text style={{ color: colors.muted, fontWeight: '600' }}>{greeting()},</Text>
              <Text variant="headlineMedium" style={{ fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>
                {firstName}
              </Text>
            </>
          ) : (
            <Text variant="headlineSmall" style={{ fontWeight: '800' }} numberOfLines={1}>
              {greeting()}
            </Text>
          )}
          {/* Shown after tapping the cloud, or when something needs your attention. */}
          {showStatus || syncing || lastErrors.length || guest || !user ? (
            <Pressable onPress={guest || !user ? () => router.push('/register') : backUp} accessibilityRole="button">
              <Text style={{ color: lastErrors.length ? colors.error : colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                {syncLine}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Your year so far (the year in travel recap). */}
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        <Pill icon="party-popper" label={`${new Date().getFullYear()} so far`} onPress={() => router.push('/wrapped')} />
      </View>

      <OnThisDayCard refreshKey={lastSyncAt} />

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

      {/* On going, coming soon and the last one completed. */}
      {featured.length ? (
        <View style={{ marginTop: 14 }}>
          {featured.map(t => (
            <TripCard
              key={t.id}
              trip={t}
              synopsis={t.synopsis}
              large
              groupCount={counts[tripStatus(t)]}
              tracking={t.id === recordingTripId}
              coverUri={t.cover}
              showUpload={Boolean(user)}
            />
          ))}
        </View>
      ) : null}

      {/* Where the full list begins (the floating "All trips" pill brings you here). */}
      {showList ? (
        <View onLayout={e => setListTop(e.nativeEvent.layout.y)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10, marginBottom: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 0.6 }}>ALL TRIPS</Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>{all.length}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        ref={listRef}
        data={showList ? rows : []}
        onScroll={e => setInList(listTop > 0 && e.nativeEvent.contentOffset.y > listTop - 60)}
        scrollEventThrottle={64}
        onScrollToIndexFailed={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
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
            all.length ? null : (
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
            tracking={item.id === recordingTripId}
            coverUri={item.cover}
            showUpload={Boolean(user)}
          />
        )}
      />
      {/* All trips: a glass pill left of the + button; jumps to the full list, or back to the top. */}
      {loaded && showList ? (
        <Pressable
          onPress={() =>
            inList
              ? listRef.current?.scrollToOffset({ offset: 0, animated: true })
              : listRef.current?.scrollToOffset({ offset: listTop + 8, animated: true }) // the list's 16 px padding, less a little air
          }
          accessibilityRole="button"
          accessibilityLabel={inList ? 'Back to the top' : `All trips, ${all.length}`}
          style={({ pressed }) => ({ position: 'absolute', right: 18 + 60 + 10, bottom: fabBottom + 8, transform: [{ scale: pressed ? 0.95 : 1 }] })}
        >
          <Glass radius={22} interactive style={{ height: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
            <Icon name={inList ? 'arrow-up' : 'format-list-bulleted'} size={18} color={colors.primary} />
            <Text style={{ fontWeight: '700', color: colors.onSurface }}>{inList ? 'Top' : 'All trips'}</Text>
          </Glass>
        </Pressable>
      ) : null}
      {/* New journey: a brand-coloured glass button floating above the tab bar (the empty screen has its own button). */}
      {loaded && !all.length ? null : (
      <Pressable
        onPress={() => router.push('/trip/new')}
        accessibilityRole="button"
        accessibilityLabel="Start a new journey"
        style={({ pressed }) => ({ position: 'absolute', right: 18, bottom: fabBottom, transform: [{ scale: pressed ? 0.94 : 1 }] })}
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
