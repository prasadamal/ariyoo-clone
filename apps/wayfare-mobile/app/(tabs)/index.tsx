import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import BottomSheet, { BottomSheetFlatList, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import { ActivityIndicator, BackHandler, Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnnouncementBanner } from '../../src/components/AnnouncementBanner';
import { TripCard } from '../../src/components/TripCard';
import { useAuth } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import { timeAgoPhrase } from '../../src/lib/format';
import { journeysOnly } from '../../src/lib/everydayMemories';
import { listTrips, type LocalTrip } from '../../src/lib/localDb';
import { prepareTripRows, type TripRow } from '../../src/lib/tripRows';
import { refreshPackingNudges } from '../../src/lib/packingReminders';
import { getActiveTrackingTripId } from '../../src/lib/locationTask';
import { backupLabel, backupState } from '../../src/lib/backupStatus';
import { featuredTrips, pinnedFirst, recentFirst, statusCounts, tripStatus, type TripStatus } from '../../src/lib/tripList';
import { loadPins, setPinned } from '../../src/lib/pins';
import { useToast } from '../../src/context/ToastContext';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/Icon';
import { Pill } from '../../src/ui/Pill';
import { SOCIAL_ENABLED } from '../../src/lib/features';
import { Glass } from '../../src/ui/Glass';

/** Journeys are prepared (stats, money, cover) a few at a time as you scroll, not all at once. */
const PAGE_SIZE = 5;


function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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
  // The home page doesn't scroll: the three tiles share whatever room is left under the greeting
  // (measured on the tiles' own box, so it's right on every phone). All trips is a panel that slides
  // up over them: tap "All trips", or swipe up firmly on the tiles.
  const [tilesArea, setTilesArea] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  // The tiles follow your finger a little while you swipe (moved on the UI thread, so it stays smooth).
  const lift = useSharedValue(0);
  const swiping = useRef(false);
  // Journeys you pinned (newest pin first): they lead their group's tile and the lists.
  const [pins, setPins] = useState<string[]>([]);
  // Bumped when you come back to Journeys or close All trips: covers redraw (see TripCover).
  const [coverEpoch, setCoverEpoch] = useState(0);
  const toast = useToast();
  const pinOwner = user?.id ?? 'guest';
  const [recordingTripId, setRecordingTripId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // The backup status shows only after you tap the cloud, then fades away.
  const [showStatus, setShowStatus] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const nudgedAt = useRef(0);
  const shown = useRef(PAGE_SIZE);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const load = useCallback(async () => {
    const [list, pinned] = await Promise.all([listTrips().then(journeysOnly), loadPins(pinOwner)]);
    const f = featuredTrips(list, new Date(), pinned);
    const top = [f.ongoing, f.upcoming, f.completed].filter((t): t is LocalTrip => Boolean(t));
    const sorted = pinnedFirst(recentFirst(list), pinned);
    // Keep as many cards as were already on screen, at least one page.
    const count = Math.max(PAGE_SIZE, Math.min(shown.current, sorted.length));
    const [page, topRows] = await Promise.all([prepareTripRows(sorted.slice(0, count)), prepareTripRows(top)]);
    shown.current = count;
    setPins(pinned);
    setAll(list);
    // Packing nudges follow packing and date changes; re-planned at most every 10 minutes.
    if (Date.now() - nudgedAt.current > 10 * 60 * 1000) {
      nudgedAt.current = Date.now();
      void refreshPackingNudges(list);
    }
    setRows(page);
    setFeatured(topRows);
    setCounts(statusCounts(list));
    setRecordingTripId(await getActiveTrackingTripId());
    setLoaded(true);
    refreshPending();
  }, [refreshPending, pinOwner]);

  useFocusEffect(
    useCallback(() => {
      load();
      setCoverEpoch(e => e + 1);
    }, [load])
  );

  // Reload when the journal is ready and whenever a sync finishes, so every trip shows at once.
  useEffect(() => {
    load();
  }, [load, lastSyncAt, journalReady]);

  const sortedAll = useMemo(() => pinnedFirst(recentFirst(all), pins), [all, pins]);

  /** Long-press a journey: pin it to the top of its group and of All trips (or unpin it). */
  const togglePin = async (t: TripRow) => {
    const pin = !pins.includes(t.id);
    try {
      setPins(await setPinned(pinOwner, t.id, pin));
      toast(pin ? `Pinned ${t.title} to the top` : `Unpinned ${t.title}`);
      await load();
    } catch {
      toast('Could not change the pin. Try again.');
    }
  };
  const hasMore = rows.length < sortedAll.length;

  /** The next page of cards, with a spinner while they're prepared. */
  const loadMore = async () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const more = await prepareTripRows(sortedAll.slice(rows.length, rows.length + PAGE_SIZE));
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

  const hasList = all.length > featured.length || all.length > 1;
  const openList = () => sheetRef.current?.expand();
  const closeList = () => sheetRef.current?.close();
  const fabBottom = Math.max(insets.bottom, 10) + 84;

  // Android's back button closes the All trips panel first.
  useEffect(() => {
    if (!listOpen || Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeList();
      return true;
    });
    return () => sub.remove();
  }, [listOpen]);

  // Swipe up on the tiles: they follow the finger a little (with resistance) and spring back; a firm
  // swipe (far enough, or fast enough) slides the All trips panel up. A firm pull down reloads.
  // The movement runs on the UI thread (Reanimated), so it keeps up with the finger.
  const markSwiping = (on: boolean) => {
    if (on) swiping.current = true;
    // A tile under the finger must not open when you let go.
    else setTimeout(() => (swiping.current = false), 250);
  };
  const refreshFromSwipe = () => void onRefresh();
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-14, 14])
        .failOffsetX([-24, 24])
        .onStart(() => {
          runOnJS(markSwiping)(true);
        })
        .onUpdate(e => {
          lift.value = e.translationY < 0 ? Math.max(-64, e.translationY * 0.32) : Math.min(40, e.translationY * 0.25);
        })
        .onEnd(e => {
          const open = hasList && (e.translationY < -110 || (e.translationY < -40 && e.velocityY < -900));
          // Settle back without bouncing; when the panel opens it rises over the tiles as they settle.
          lift.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.7, overshootClamping: open });
          if (open) runOnJS(openList)();
          else if (e.translationY > 110) runOnJS(refreshFromSwipe)();
        })
        .onFinalize(() => {
          runOnJS(markSwiping)(false);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasList]
  );
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  // The All trips panel glides up and settles without a wobble.
  const sheetSpring = useBottomSheetSpringConfigs({ damping: 30, stiffness: 260, mass: 0.8, overshootClamping: true });

  // Your year so far (the year in travel recap), beside your name.
  const yearPill = <Pill icon="party-popper" label={`${new Date().getFullYear()} so far`} onPress={() => router.push('/wrapped')} />;

  // The three tiles share the room left under the greeting, less the gaps (a stacked group tile
  // needs a little more room underneath).
  const gaps = featured.reduce((sum, t) => sum + (counts[tripStatus(t)] > 1 ? 30 : 14), 0);
  const tileHeight = tilesArea && featured.length
    ? Math.max(96, Math.min(240, Math.floor((tilesArea - gaps) / Math.max(featured.length, 3))))
    : undefined;
  /** A tile: the journey itself when it's the only one in its group, else that group's list. */
  const openTile = (t: TripRow) => {
    if (swiping.current) return;
    const status = tripStatus(t);
    // Several journeys on the road (or coming up, or done): the tile opens that group's list.
    if (counts[status] > 1) router.push({ pathname: '/trips/[status]', params: { status } } as never);
    else router.push(`/trip/${t.id}`);
  };

  const top = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          {firstName ? (
            <>
              <Text style={{ color: colors.muted, fontWeight: '600' }}>{greeting()},</Text>
              {/* Your name, with your year so far at the right edge of the screen. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text variant="headlineMedium" style={{ fontWeight: '800', flex: 1 }} numberOfLines={1} adjustsFontSizeToFit>
                  {firstName}
                </Text>
                {yearPill}
              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text variant="headlineSmall" style={{ fontWeight: '800', flex: 1 }} numberOfLines={1}>
                {greeting()}
              </Text>
              {yearPill}
            </View>
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

      {/* A short message from the Wayfare team (admin console), if there is one. */}
      <AnnouncementBanner />

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
    </View>
  );

  const tiles = featured.length ? (
    <Reanimated.View style={liftStyle}>
      {featured.map(t => (
        <TripCard
          key={t.id}
          trip={t}
          synopsis={t.synopsis}
          large
          height={tileHeight}
          onPress={() => openTile(t)}
          onLongPress={() => void togglePin(t)}
          pinned={pins.includes(t.id)}
          imageKey={coverEpoch}
          groupCount={counts[tripStatus(t)]}
          tracking={t.id === recordingTripId}
          coverUri={t.cover}
          showUpload={Boolean(user)}
        />
      ))}
    </Reanimated.View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GestureDetector gesture={swipe}>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
          {top}
          {refreshing ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
          {/* The tiles' own box: everything between the greeting and the "All trips" button. */}
          <View style={{ flex: 1, marginTop: 14 }} onLayout={e => setTilesArea(e.nativeEvent.layout.height)}>
            {!loaded ? (
              <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
            ) : all.length ? (
              tiles
            ) : (
              <EmptyState
                icon="map-marker-path"
                animation="travel"
                title="Where to next?"
                body="Start a journey to journal moments offline, plan each day, split costs and add your crew."
                action="Start a journey"
                onAction={() => router.push('/trip/new')}
                secondary={SOCIAL_ENABLED ? 'Explore destinations' : undefined}
                onSecondary={SOCIAL_ENABLED ? () => router.push('/(tabs)/discover') : undefined}
              />
            )}
          </View>
          {/* Room for the "All trips" button and the + above the tab bar. */}
          <View style={{ height: fabBottom + 62 }} />
        </View>
      </GestureDetector>

      {/* All trips: a small pill centred above the tab bar; it slides the full list up. */}
      {loaded && hasList ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: fabBottom + 17, alignItems: 'center' }}>
          <View style={{ borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
            <Pill icon="chevron-up" label="All trips" onPress={openList} />
          </View>
        </View>
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

      {/* The full list: a panel that slides up over the tiles and drags back down to close. */}
      {hasList ? (
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={['100%']}
          enableDynamicSizing={false}
          enablePanDownToClose
          animationConfigs={sheetSpring}
          bottomInset={fabBottom - 6}
          onChange={i => {
            setListOpen(i >= 0);
            // Back on the tiles: redraw their covers (Android may have lent their memory to the list).
            if (i < 0) setCoverEpoch(e => e + 1);
          }}
          // Flip as the panel starts moving, so screen readers only find its contents while it is up.
          onAnimate={(_from, to) => setListOpen(to >= 0)}
          backgroundStyle={{ backgroundColor: colors.background, borderRadius: 28 }}
          handleIndicatorStyle={{ backgroundColor: colors.outline, width: 40 }}
          style={{ shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}
        >
          {/* Closed, the panel waits just below the screen: hidden from TalkBack/VoiceOver until it opens. */}
          <View
            style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}
            accessibilityRole="header"
            importantForAccessibility={listOpen ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={!listOpen}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 0.6 }}>ALL TRIPS</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>{all.length}</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={closeList} accessibilityRole="button" accessibilityLabel="Close all trips" hitSlop={10}>
              <Icon name="chevron-down" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <BottomSheetFlatList
            importantForAccessibility={listOpen ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={!listOpen}
            data={rows}
            keyExtractor={(t: TripRow) => t.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore || hasMore ? (
                <View style={{ paddingVertical: 18, alignItems: 'center' }} accessibilityLabel="Loading more journeys">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null
            }
            renderItem={({ item }: { item: TripRow }) => (
              <TripCard
                trip={item}
                synopsis={item.synopsis}
                tracking={item.id === recordingTripId}
                coverUri={item.cover}
                showUpload={Boolean(user)}
                pinned={pins.includes(item.id)}
                onLongPress={() => void togglePin(item)}
              />
            )}
          />
        </BottomSheet>
      ) : null}
    </View>
  );
}
