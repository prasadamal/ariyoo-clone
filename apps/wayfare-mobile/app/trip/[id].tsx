import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, IconButton, Menu, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { BudgetSection } from '../../src/components/trip/BudgetSection';
import { JournalSection } from '../../src/components/trip/JournalSection';
import { PackingSection } from '../../src/components/trip/PackingSection';
import { RouteSection } from '../../src/components/trip/RouteSection';
import { useAuth } from '../../src/context/AuthContext';
import { useTripData } from '../../src/hooks/useTripData';
import { deleteTrip, upsertTrip } from '../../src/lib/localDb';
import { deleteLocalFiles } from '../../src/lib/media';
import { ShareError, shareTripLink, stopSharingTrip } from '../../src/lib/shareTrip';
import { stopTripTracking } from '../../src/lib/tracking';
import { exportTripJournalPdf } from '../../src/lib/tripPdf';

type Tab = 'journal' | 'budget' | 'packing' | 'route';

export default function TripDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const { user } = useAuth();
  const { loaded, trip, synopsis, entries, expenses, packing, route, tracking, reload, changed } = useTripData(tripId);
  const [tab, setTab] = useState<Tab>('journal');
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!trip) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text variant="titleLarge">Trip not found</Text>
        <Text style={{ marginVertical: 8, color: theme.colors.onSurfaceVariant }}>It may have been deleted on another device.</Text>
        <Button mode="contained" onPress={() => router.replace('/(tabs)')}>Back to journeys</Button>
      </View>
    );
  }

  const shared = trip.visibility === 'link' && !!trip.share_id;
  const packedCount = packing.filter(p => p.packed).length;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert(e instanceof ShareError ? 'Sharing' : 'Something went wrong', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
      await reload();
    }
  };

  const setStatus = (status: 'active' | 'completed') =>
    run(async () => {
      await upsertTrip({ ...trip, status, sync_status: 'pending', updated_at: new Date().toISOString() });
      changed();
    });

  const confirmDelete = () =>
    Alert.alert(
      'Delete trip',
      'This permanently deletes the trip with all its entries, photos, voice notes, expenses and route — on this device and in your cloud backup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete trip',
          style: 'destructive',
          onPress: async () => {
            await stopTripTracking().catch(() => {});
            deleteLocalFiles(await deleteTrip(tripId));
            changed();
            router.replace('/(tabs)');
          },
        },
      ]
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: trip.title.length > 24 ? `${trip.title.slice(0, 24)}…` : trip.title }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 64 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text variant="headlineSmall">{trip.title}</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {[trip.destination, trip.trip_type, [trip.starts_on, trip.ends_on].filter(Boolean).join(' → ')].filter(Boolean).join(' · ')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {trip.status === 'completed' ? <Chip compact icon="check">Completed</Chip> : null}
              {shared ? <Chip compact icon="link-variant">Shared link on</Chip> : null}
              {tracking ? <Chip compact icon="record-circle-outline">Recording route</Chip> : null}
            </View>
          </View>
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={<IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} disabled={busy} accessibilityLabel="Trip actions" />}
          >
            <Menu.Item leadingIcon="pencil" title="Edit trip details" onPress={() => { setMenuOpen(false); router.push({ pathname: '/trip/new', params: { editId: trip.id } }); }} />
            <Menu.Item leadingIcon="share-variant" title={shared ? 'Share link again' : 'Share read-only link'} onPress={() => { setMenuOpen(false); run(async () => { await shareTripLink(trip, user?.id ?? null); changed(); }); }} />
            {shared ? <Menu.Item leadingIcon="link-off" title="Stop sharing" onPress={() => { setMenuOpen(false); run(async () => { await stopSharingTrip(trip, user?.id ?? null); changed(); }); }} /> : null}
            <Menu.Item leadingIcon="file-pdf-box" title="Export PDF journal" onPress={() => { setMenuOpen(false); run(async () => { await exportTripJournalPdf(trip); }); }} />
            {trip.status === 'completed' ? (
              <Menu.Item leadingIcon="restore" title="Reopen trip" onPress={() => { setMenuOpen(false); setStatus('active'); }} />
            ) : (
              <Menu.Item leadingIcon="check-circle-outline" title="Mark trip complete" onPress={() => { setMenuOpen(false); setStatus('completed'); }} />
            )}
            <Menu.Item leadingIcon="delete-outline" title="Delete trip" onPress={() => { setMenuOpen(false); confirmDelete(); }} />
          </Menu>
        </View>

        <Card style={{ marginVertical: 12 }}>
          <Card.Content>
            <Text>{synopsis}</Text>
            {trip.notes ? <Text style={{ marginTop: 8, fontSize: 13, color: theme.colors.onSurfaceVariant }}>{trip.notes}</Text> : null}
          </Card.Content>
        </Card>

        <SegmentedButtons
          value={tab}
          onValueChange={v => setTab(v as Tab)}
          density="small"
          buttons={[
            { value: 'journal', label: 'Journal' },
            { value: 'budget', label: 'Budget' },
            { value: 'packing', label: `Pack ${packedCount}/${packing.length}` },
            { value: 'route', label: 'Route' },
          ]}
          style={{ marginBottom: 16 }}
        />

        {tab === 'journal' && <JournalSection tripId={tripId} entries={entries} onChanged={changed} />}
        {tab === 'budget' && <BudgetSection tripId={tripId} expenses={expenses} onChanged={changed} />}
        {tab === 'packing' && <PackingSection tripId={tripId} items={packing} onChanged={changed} />}
        {tab === 'route' && <RouteSection tripId={tripId} title={trip.title} route={route} tracking={tracking} onChanged={changed} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
