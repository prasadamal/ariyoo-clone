import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { ActivityIndicator, IconButton, Menu, Text } from 'react-native-paper';
import { tripTypeIcon } from '../../src/components/TripCard';
import { getDestination } from '../../src/content/destinations';
import { useAuth, useCanConnect } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import { useToast } from '../../src/context/ToastContext';
import { BudgetTab } from '../../src/features/trip/BudgetTab';
import { CrewTab } from '../../src/features/trip/CrewTab';
import { JournalTab } from '../../src/features/trip/JournalTab';
import { PackingTab } from '../../src/features/trip/PackingTab';
import { PlanTab } from '../../src/features/trip/PlanTab';
import { RouteTab } from '../../src/features/trip/RouteTab';
import { daysUntil, formatDateRange, formatKm, tripPhase } from '../../src/lib/format';
import { deleteTrip, getTrip, updateTrip, type LocalTrip } from '../../src/lib/localDb';
import { getActiveTrackingTripId, stopTripTracking } from '../../src/lib/locationTask';
import { shareTripLink } from '../../src/lib/shareTrip';
import { pushTripNow } from '../../src/lib/sync';
import { exportTripJournalPdf } from '../../src/lib/tripPdf';
import { computeTripStats, formatSpend, type TripStats } from '../../src/lib/tripStats';
import { useAppTheme } from '../../src/theme';
import { Icon } from '../../src/ui/Icon';
import { Pill } from '../../src/ui/Pill';
import { Screen } from '../../src/ui/Screen';
import { TabStrip, type TabItem } from '../../src/ui/TabStrip';

type Tab = 'journal' | 'plan' | 'budget' | 'pack' | 'route' | 'crew';

const TABS: TabItem<Tab>[] = [
  { value: 'journal', label: 'Journal', icon: 'notebook-outline' },
  { value: 'plan', label: 'Plan', icon: 'calendar-text-outline' },
  { value: 'budget', label: 'Budget', icon: 'wallet-outline' },
  { value: 'pack', label: 'Pack', icon: 'bag-checked' },
  { value: 'route', label: 'Route', icon: 'map-marker-path' },
  { value: 'crew', label: 'Crew', icon: 'account-group-outline' },
];

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const tripId = String(params.id);
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const canConnect = useCanConnect();
  const { refreshPending } = useSync();
  const toast = useToast();
  const [trip, setTrip] = useState<LocalTrip | null | undefined>(undefined);
  const [stats, setStats] = useState<TripStats | null>(null);
  const [tab, setTab] = useState<Tab>(TABS.some(t => t.value === params.tab) ? (params.tab as Tab) : 'journal');
  const [menu, setMenu] = useState(false);

  const load = useCallback(async () => {
    const t = await getTrip(tripId);
    setTrip(t);
    if (t) setStats(await computeTripStats(tripId));
    refreshPending();
  }, [tripId, refreshPending]);

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

  const dest = getDestination(trip.place_key);
  const phase = tripPhase(trip.starts_on, trip.ends_on);
  const until = daysUntil(trip.starts_on);

  const markComplete = async (done: boolean) => {
    await updateTrip(trip.id, { status: done ? 'completed' : 'active' });
    if (done && (await getActiveTrackingTripId()) === trip.id) await stopTripTracking();
    await load();
    if (done && canConnect) {
      toast('Journey complete! 🎉', { label: 'Share it', onPress: () => router.push({ pathname: '/post/new', params: { tripId: trip.id, kind: 'trip' } }) });
    }
  };

  const remove = () =>
    Alert.alert('Delete journey?', 'This deletes its journal, photos, plan, expenses and route on all your devices.', [
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

  const shareLink = async () => {
    try {
      await shareTripLink(trip);
      if (user) await pushTripNow(user.id, trip.id).catch(() => toast('Link will work once this journey syncs.'));
      else toast('Sign in so the link can be opened by others.');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not share');
    }
  };

  const exportPdf = async () => {
    try {
      await exportTripJournalPdf(trip);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF export failed');
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: trip.title }} />
      <LinearGradient
        colors={[colors.heroStart, colors.heroEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 22, padding: 16, paddingRight: 6 }}
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
            <Text variant="headlineSmall" style={{ color: '#fff', fontWeight: '900', marginTop: 6 }}>
              {trip.title}
            </Text>
            <Text
              style={{ color: '#ffffffe6', marginTop: 2 }}
              onPress={trip.place_key ? () => router.push(`/place/${trip.place_key}`) : undefined}
            >
              {[dest?.name ?? trip.destination, formatDateRange(trip.starts_on, trip.ends_on)].filter(Boolean).join(' · ') || 'Add a destination and dates'}
              {trip.place_key ? '  ›' : ''}
            </Text>
          </View>
          <Menu
            visible={menu}
            onDismiss={() => setMenu(false)}
            anchor={<IconButton icon="dots-vertical" iconColor="#fff" onPress={() => setMenu(true)} accessibilityLabel="Journey options" />}
          >
            <Menu.Item leadingIcon="pencil-outline" title="Edit details" onPress={() => { setMenu(false); router.push(`/trip/edit/${trip.id}`); }} />
            {canConnect ? (
              <Menu.Item
                leadingIcon="share-variant-outline"
                title="Share to feed"
                onPress={() => {
                  setMenu(false);
                  router.push({ pathname: '/post/new', params: { tripId: trip.id, kind: 'trip' } });
                }}
              />
            ) : null}
            <Menu.Item leadingIcon="link-variant" title="Share read-only link" onPress={() => { setMenu(false); shareLink(); }} />
            <Menu.Item leadingIcon="file-pdf-box" title="Export PDF journal" onPress={() => { setMenu(false); exportPdf(); }} />
            <Menu.Item
              leadingIcon={trip.status === 'completed' ? 'restore' : 'flag-checkered'}
              title={trip.status === 'completed' ? 'Reopen journey' : 'Mark complete'}
              onPress={() => {
                setMenu(false);
                markComplete(trip.status !== 'completed');
              }}
            />
            <Menu.Item leadingIcon="delete-outline" title="Delete journey" onPress={() => { setMenu(false); remove(); }} />
          </Menu>
        </View>
        {stats ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingRight: 10 }}>
            <Pill icon="feather" label={`${stats.entryCount} moments`} color="#fff" background="#ffffff26" />
            {stats.photoCount ? <Pill icon="camera-outline" label={`${stats.photoCount}`} color="#fff" background="#ffffff26" /> : null}
            {stats.distanceKm >= 0.1 ? <Pill icon="map-marker-path" label={formatKm(stats.distanceKm)} color="#fff" background="#ffffff26" /> : null}
            {formatSpend(stats.spendByCurrency) ? <Pill icon="wallet-outline" label={formatSpend(stats.spendByCurrency)} color="#fff" background="#ffffff26" /> : null}
            {trip.open_to_meet ? <Pill icon="account-group" label="Open to meet" color="#fff" background="#ffffff26" /> : null}
            {trip.visibility === 'link' ? <Pill icon="link-variant" label="Shared link" color="#fff" background="#ffffff26" /> : null}
          </View>
        ) : null}
      </LinearGradient>

      {trip.notes ? (
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, marginTop: 12, lineHeight: 19 }} numberOfLines={4}>
          {trip.notes}
        </Text>
      ) : null}

      <View style={{ marginVertical: 14 }}>
        <TabStrip tabs={TABS} value={tab} onChange={setTab} />
      </View>

      {tab === 'journal' ? <JournalTab trip={trip} onChanged={load} /> : null}
      {tab === 'plan' ? <PlanTab trip={trip} onChanged={load} /> : null}
      {tab === 'budget' ? <BudgetTab trip={trip} onChanged={load} /> : null}
      {tab === 'pack' ? <PackingTab trip={trip} onChanged={load} /> : null}
      {tab === 'route' ? <RouteTab trip={trip} onChanged={load} /> : null}
      {tab === 'crew' ? <CrewTab trip={trip} onChanged={load} /> : null}
    </Screen>
  );
}
