import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { exportPhotoBook } from '../../src/lib/photoBook';
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Menu, Text } from 'react-native-paper';
import { tripTypeIcon } from '../../src/components/TripCard';
import { getDestination } from '../../src/content/destinations';
import { useAuth, useCanConnect, useSocial } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import { useToast } from '../../src/context/ToastContext';
import { BudgetTab } from '../../src/features/trip/BudgetTab';
import { CrewTab } from '../../src/features/trip/CrewTab';
import { TripCrew } from '../../src/features/trip/TripCrew';
import { cachedCrew, canEditTrip, isSharedTrip, leaveTrip, loadCrew, personName, tripRole, type CrewPerson } from '../../src/lib/crew';
import { isEverydayTrip } from '../../src/lib/everydayMemories';
import { Glass } from '../../src/ui/Glass';
import { tripCoverUri } from '../../src/lib/tripCover';
import { JournalTab } from '../../src/features/trip/JournalTab';
import { PlanPackTab } from '../../src/features/trip/PlanPackTab';
import { RouteTab } from '../../src/features/trip/RouteTab';
import { daysUntil, formatDateRange, formatKm, tripPhase } from '../../src/lib/format';
import { deleteTrip, getTrip, setTripCover, updateTrip, type LocalTrip } from '../../src/lib/localDb';
import { persistCoverPhoto } from '../../src/lib/media';
import { pickPhotos } from '../../src/features/trip/photoPicker';
import { TripCover } from '../../src/ui/TripCover';
import { coverArtFor } from '../../src/ui/coverArt';
import { getActiveTrackingTripId, stopTripTracking } from '../../src/lib/locationTask';
import { pushTripNow } from '../../src/lib/sync';
import { exportTripJournalPdf } from '../../src/lib/tripPdf';
import { computeTripStats, type TripStats } from '../../src/lib/tripStats';
import { useAppTheme } from '../../src/theme';
import { Icon } from '../../src/ui/Icon';
import { Pill } from '../../src/ui/Pill';
import { Screen } from '../../src/ui/Screen';
import { TabStrip, type TabItem } from '../../src/ui/TabStrip';
import { SOCIAL_ENABLED } from '../../src/lib/features';
import { BudgetBar } from '../../src/ui/BudgetBar';
import { getRates, type RatesSnapshot } from '../../src/lib/currency';
import { splitSpend } from '../../src/lib/currencyMath';

type Tab = 'journal' | 'plan' | 'budget' | 'route' | 'crew';

const ALL_TABS: TabItem<Tab>[] = [
  { value: 'journal', label: 'Journal', icon: 'notebook-outline' },
  { value: 'plan', label: 'Plan & Pack', icon: 'clipboard-check-outline' },
  { value: 'budget', label: 'Budget', icon: 'wallet-outline' },
  { value: 'route', label: 'Route', icon: 'map-marker-path' },
  { value: 'crew', label: 'Crew', icon: 'account-group-outline' },
];

/** A round glass button on the cover. */
function CoverButton({ icon, label, onPress, badge }: { icon: string; label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <Glass variant="media" interactive radius={20} style={{ height: 40, minWidth: 40, paddingHorizontal: badge ? 10 : 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Icon name={icon} size={20} color="#fff" />
        {badge ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{badge}</Text> : null}
      </Glass>
    </Pressable>
  );
}

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const tripId = String(params.id);
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const canConnect = useCanConnect();
  const social = useSocial();
  const [rates, setRates] = useState<RatesSnapshot | null>(null);
  useEffect(() => {
    getRates().then(setRates).catch(() => null);
  }, []);
  const { refreshPending } = useSync();
  const toast = useToast();
  const [trip, setTrip] = useState<LocalTrip | null | undefined>(undefined);
  const [stats, setStats] = useState<TripStats | null>(null);
  const [tab, setTab] = useState<Tab>(ALL_TABS.some(t => t.value === params.tab) ? (params.tab as Tab) : 'journal');
  const [menu, setMenu] = useState(false);
  const [crew, setCrew] = useState<CrewPerson[]>([]);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  // The journal hands over its "load more"; scrolling near the bottom calls it.
  const loadMoreRef = useRef<(() => void) | null>(null);
  const pageRef = useRef<ScrollView | null>(null);
  const journalY = useRef(0);
  const registerLoadMore = useCallback((fn: () => void) => {
    loadMoreRef.current = fn;
  }, []);

  const load = useCallback(async () => {
    const t = await getTrip(tripId);
    setTrip(t);
    if (t) {
      setStats(await computeTripStats(tripId, t));
      setCoverUri(await tripCoverUri(t));
    }
    refreshPending();
  }, [tripId, refreshPending]);

  // Names for moments written by other people in a shared journey (last known list works offline).
  const shared = trip ? isSharedTrip(trip) : false;
  useEffect(() => {
    if (!shared) return;
    let alive = true;
    cachedCrew(tripId).then(list => alive && list.length && setCrew(list));
    if (canConnect) loadCrew(tripId).then(list => alive && setCrew(list)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [shared, tripId, canConnect]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (trip === undefined) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!trip) {
    return (
      <Screen>
        <Text variant="titleMedium">This journey is no longer on this device.</Text>
      </Screen>
    );
  }

  const role = tripRole(trip);
  const canEdit = canEditTrip(trip);
  const everyday = isEverydayTrip(trip);
  // Members only look, so no route recording; the everyday journal is never shared.
  const tabs = ALL_TABS.filter(t => !(t.value === 'route' && !canEdit) && !(t.value === 'crew' && everyday));
  const crewNames: Record<string, string> = Object.fromEntries(crew.map(p => [p.user_id, p.username ? `@${p.username}` : personName(p)]));
  const dest = getDestination(trip.place_key);
  const phase = tripPhase(trip.starts_on, trip.ends_on);
  const until = daysUntil(trip.starts_on);

  const changeCover = async () => {
    try {
      const [photo] = await pickPhotos(false);
      if (!photo) return;
      await setTripCover(trip.id, await persistCoverPhoto(photo.uri, photo));
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the cover photo');
    }
  };

  const markComplete = async (done: boolean) => {
    await updateTrip(trip.id, { status: done ? 'completed' : 'active' });
    if (done && (await getActiveTrackingTripId()) === trip.id) await stopTripTracking();
    await load();
    if (done && social) {
      toast('Journey complete! 🎉', { label: 'Share it', onPress: () => router.push({ pathname: '/post/new', params: { tripId: trip.id, kind: 'trip' } }) });
    }
  };

  const remove = () =>
    Alert.alert('Delete journey?', shared ? 'This deletes it for everyone in the crew too: its journal, photos, plan, expenses and route.' : 'This deletes its journal, photos, plan, expenses and route on all your devices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if ((await getActiveTrackingTripId()) === trip.id) await stopTripTracking();
          await deleteTrip(trip.id);
          router.replace('/(tabs)');
        },
      },
    ]);

  const leave = () =>
    Alert.alert('Leave this journey?', 'It disappears from your phone. Moments you added stay in the journey.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            if (user) await leaveTrip(trip.id, user.id);
            router.replace('/(tabs)');
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not leave the journey');
          }
        },
      },
    ]);

  const exportPdf = async () => {
    try {
      await exportTripJournalPdf(trip);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF export failed');
    }
  };

  const spend = stats ? splitSpend(stats.spendByCurrency, trip.currency || 'INR', rates?.rates ?? null) : { total: 0, pending: [] };

  return (
    <Screen scrollRef={pageRef} onEndReached={() => (tab === 'journal' ? loadMoreRef.current?.() : undefined)}>
      <Stack.Screen options={{ title: trip.title }} />
      <TripCover
        glass
        uri={coverUri}
        art={coverArtFor(trip.trip_type)}
        gradient={[colors.heroStart, colors.heroEnd]}
        style={{ borderRadius: 22, padding: 16, paddingRight: 6, minHeight: coverUri ? 210 : undefined }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={tripTypeIcon(trip.trip_type)} size={16} color="#ffffffcc" />
              <Text style={{ color: '#ffffffcc', fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
                {trip.status === 'completed'
                  ? 'COMPLETED'
                  : phase === 'upcoming' && until != null
                    ? `IN ${until} DAY${until === 1 ? '' : 'S'}`
                    : phase === 'ongoing'
                      ? 'ON THE ROAD'
                      : phase === 'past'
                        ? 'PAST'
                        : 'PLANNING'}
              </Text>
            </View>
            <Text variant="headlineSmall" style={{ color: '#fff', fontWeight: '900', marginTop: 6 }} numberOfLines={2}>
              {trip.title}
            </Text>
            {trip.owner_id && trip.owner_name ? (
              <Text style={{ color: '#ffffffcc', fontSize: 13, marginTop: 2 }}>
                Shared by {trip.owner_name} · you're {role === 'admin' ? 'an admin' : 'a member'}
              </Text>
            ) : null}
            <Text
              style={{ color: '#ffffffe6', marginTop: 2 }}
              onPress={social && trip.place_key ? () => router.push(`/place/${trip.place_key}`) : undefined}
            >
              {[dest?.name ?? trip.destination, formatDateRange(trip.starts_on, trip.ends_on)].filter(Boolean).join(' · ') || 'Add a destination and dates'}
              {social && trip.place_key ? '  ›' : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginRight: 10 }}>
          {everyday ? null : (
            <CoverButton
              icon={shared ? 'account-group' : 'account-plus-outline'}
              label={shared ? `Crew, ${trip.crew_count} people` : 'Add crew'}
              badge={shared ? trip.crew_count ?? undefined : undefined}
              onPress={() => setTab('crew')}
            />
          )}
          <Menu
            visible={menu}
            onDismiss={() => setMenu(false)}
            anchor={<CoverButton icon="dots-horizontal" label="Journey options" onPress={() => setMenu(true)} />}
          >
            {canEdit ? (
              <Menu.Item leadingIcon="pencil-outline" title="Edit details" onPress={() => { setMenu(false); router.push(`/trip/edit/${trip.id}`); }} />
            ) : null}
            <Menu.Item leadingIcon="image-edit-outline" title={trip.cover_uri ? 'Change cover photo' : 'Add cover photo'} onPress={() => { setMenu(false); void changeCover(); }} />
            {social ? (
              <Menu.Item
                leadingIcon="share-variant-outline"
                title="Share to feed"
                onPress={() => {
                  setMenu(false);
                  router.push({ pathname: '/post/new', params: { tripId: trip.id, kind: 'trip' } });
                }}
              />
            ) : null}
            <Menu.Item leadingIcon="image-outline" title="Share recap image" onPress={() => { setMenu(false); router.push(`/trip/recap/${trip.id}` as never); }} />
            <Menu.Item leadingIcon="file-pdf-box" title="Export PDF journal" onPress={() => { setMenu(false); exportPdf(); }} />
            <Menu.Item
              leadingIcon="book-open-page-variant-outline"
              title="Photo book (PDF to print)"
              onPress={() => {
                setMenu(false);
                toast('Making your photo book…');
                exportPhotoBook(trip).catch(e => toast(e instanceof Error ? e.message : 'Could not make the photo book'));
              }}
            />
            {canEdit ? (
              <Menu.Item
                leadingIcon={trip.status === 'completed' ? 'restore' : 'flag-checkered'}
                title={trip.status === 'completed' ? 'Reopen journey' : 'Mark complete'}
                onPress={() => {
                  setMenu(false);
                  markComplete(trip.status !== 'completed');
                }}
              />
            ) : null}
            {role === 'owner' ? (
              <Menu.Item leadingIcon="delete-outline" title="Delete journey" onPress={() => { setMenu(false); remove(); }} />
            ) : (
              <Menu.Item leadingIcon="exit-run" title="Leave journey" onPress={() => { setMenu(false); leave(); }} />
            )}
          </Menu>
          </View>
        </View>
        {stats ? (
          // Counts and money float straight on the cover photo.
          <View style={{ marginTop: 14, marginRight: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {/* Moments carry the app's own mark, in the same white as the other pills. */}
            <View accessible accessibilityLabel={`${stats.entryCount} ${stats.entryCount === 1 ? 'moment' : 'moments'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#ffffff26' }}>
              <ExpoImage source={require('../../assets/logo-mark.png')} style={{ width: 22, height: 13 }} tintColor="#fff" contentFit="contain" />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{`${stats.entryCount} ${stats.entryCount === 1 ? 'moment' : 'moments'}`}</Text>
            </View>
            {stats.photoCount ? <Pill icon="camera-outline" label={`${stats.photoCount}`} color="#fff" background="#ffffff26" /> : null}
            {stats.distanceKm >= 0.1 ? <Pill icon="map-marker-path" label={formatKm(stats.distanceKm)} color="#fff" background="#ffffff26" /> : null}
            {social && trip.open_to_meet ? <Pill icon="account-group" label="Open to meet" color="#fff" background="#ffffff26" /> : null}
          </View>
            <BudgetBar
              compact
              spent={spend.total}
              unconverted={spend.pending}
              budget={trip.budget_total}
              currency={trip.currency || 'INR'}
              onAddBudget={canEdit ? () => router.push(`/trip/edit/${trip.id}`) : undefined}
            />
          </View>
        ) : null}
      </TripCover>

      {/* The journey's dates are over: wrap it up, and share the recap. */}
      {!everyday && canEdit && trip.status !== 'completed' && tripPhase(trip.starts_on, trip.ends_on) === 'past' ? (
        <View style={{ marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: colors.primaryContainer }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: colors.onPrimaryContainer }}>This journey is over 🎉</Text>
          <Text style={{ color: colors.onPrimaryContainer, marginTop: 2 }}>Mark it complete and share a recap of it.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button
              mode="contained"
              compact
              onPress={async () => {
                const next = await updateTrip(trip.id, { status: 'completed' });
                if (next) setTrip(next);
                refreshPending();
                router.push(`/trip/recap/${trip.id}` as never);
              }}
            >
              Complete & see recap
            </Button>
            <Button compact onPress={() => router.push(`/trip/recap/${trip.id}` as never)}>
              Just the recap
            </Button>
          </View>
        </View>
      ) : null}

      <View style={{ marginVertical: 14 }}>
        <TabStrip tabs={tabs} value={tabs.some(t => t.value === tab) ? tab : 'journal'} onChange={setTab} />
      </View>

      {tab === 'journal' || !tabs.some(t => t.value === tab) ? <View onLayout={e => (journalY.current = e.nativeEvent.layout.y)}>
          <JournalTab
            trip={trip}
            onChanged={load}
            crewNames={crewNames}
            registerLoadMore={registerLoadMore}
            onJumpTo={y => pageRef.current?.scrollTo({ y: Math.max(0, journalY.current + y - 8), animated: true })}
          />
        </View> : null}
      {tab === 'plan' ? <PlanPackTab trip={trip} onChanged={load} readOnly={!canEdit} /> : null}
      {tab === 'budget' ? <BudgetTab trip={trip} onChanged={load} readOnly={!canEdit} /> : null}
      {tab === 'route' && canEdit ? <RouteTab trip={trip} onChanged={load} /> : null}
      {tab === 'crew' && !everyday ? (
        <>
          <TripCrew trip={trip} onChanged={load} onCrew={setCrew} />
          {SOCIAL_ENABLED ? <CrewTab trip={trip} onChanged={load} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
