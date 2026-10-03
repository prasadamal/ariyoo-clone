import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';
import { Button, Card, Chip, IconButton, Menu, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { v4 as uuid } from 'uuid';
import { EntryMediaStrip } from '../../src/components/EntryMediaStrip';
import { EntryVoiceNotes } from '../../src/components/EntryVoiceNotes';
import { MoodChips } from '../../src/components/MoodChips';
import { RouteMap } from '../../src/components/RouteMap';
import { useWayfareTheme } from '../../src/context/ThemeContext';
import {
  countTrackPoints,
  deleteTrip,
  getTrip,
  listEntries,
  listExpenses,
  listPacking,
  listTrackPointsForExport,
  upsertEntry,
  upsertExpense,
  upsertEntryMedia,
  upsertPackingItem,
  upsertTrip,
  type LocalEntry,
  type LocalExpense,
  type LocalPackingItem,
  type LocalTrip,
} from '../../src/lib/localDb';
import { buildTripGeoJson } from '../../src/lib/geoExport';
import { exportTripJournalPdf } from '../../src/lib/tripPdf';
import { computeTripStats, buildTripSynopsis } from '../../src/lib/tripStats';
import { startTripTracking, stopTripTracking, getActiveTrackingTripId } from '../../src/lib/tracking';
import { copyShareTrip } from '../../src/lib/shareTrip';
import { startVoiceRecording, stopVoiceRecordingAndSave } from '../../src/lib/voiceNote';
import { fetchWeatherSummary } from '../../src/lib/weather';

type Tab = 'journal' | 'budget' | 'packing' | 'route';

const EXPENSE_CATS = ['food', 'stay', 'transport', 'gear', 'permit', 'other'];

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const [tab, setTab] = useState<Tab>('journal');
  const [trip, setTrip] = useState<LocalTrip | null>(null);
  const [synopsis, setSynopsis] = useState('');
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [packing, setPacking] = useState<LocalPackingItem[]>([]);
  const [routePoints, setRoutePoints] = useState<{ latitude: number; longitude: number }[]>([]);
  const [points, setPoints] = useState(0);
  const [entryText, setEntryText] = useState('');
  const [mood, setMood] = useState('');
  const [place, setPlace] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('food');
  const [tracking, setTracking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [useLocationWeather, setUseLocationWeather] = useState(true);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceEntryId, setVoiceEntryId] = useState<string | null>(null);
  const { paperTheme } = useWayfareTheme();

  const load = useCallback(async () => {
    const t = await getTrip(tripId);
    setTrip(t);
    if (t) {
      const stats = await computeTripStats(tripId);
      setSynopsis(buildTripSynopsis(t.title, stats));
    }
    setEntries(await listEntries(tripId));
    setExpenses(await listExpenses(tripId));
    setPacking(await listPacking(tripId));
    const track = await listTrackPointsForExport(tripId);
    setRoutePoints(track.map(p => ({ latitude: p.latitude, longitude: p.longitude })));
    setPoints(await countTrackPoints(tripId));
    setTracking(getActiveTrackingTripId() === tripId);
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const attachPhotoToEntry = async (entryId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const now = new Date().toISOString();
    await upsertEntryMedia({
      id: uuid(),
      trip_id: tripId,
      entry_id: entryId,
      local_uri: asset.uri,
      storage_path: null,
      mime_type: asset.mimeType ?? 'image/jpeg',
      sync_status: 'pending',
      updated_at: now,
    });
    await load();
  };

  const resolveWeather = async (): Promise<string | null> => {
    if (!useLocationWeather) return null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return await fetchWeatherSummary(loc.coords.latitude, loc.coords.longitude);
    } catch {
      return null;
    }
  };

  const addEntry = async () => {
    if (!entryText.trim()) return;
    const now = new Date().toISOString();
    const weather = await resolveWeather();
    const entryId = uuid();
    await upsertEntry({
      id: entryId,
      trip_id: tripId,
      recorded_at: now,
      body: entryText.trim(),
      mood: mood || null,
      place_name: place || null,
      weather,
      sync_status: 'pending',
      updated_at: now,
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEntryText('');
    setMood('');
    setPlace('');
    await load();
    return entryId;
  };

  const addEntryWithPhoto = async () => {
    const entryId = await addEntry();
    if (entryId) await attachPhotoToEntry(entryId);
  };

  const exportRoute = async () => {
    if (!trip) return;
    const geo = await buildTripGeoJson(tripId, trip.title);
    await Share.share({ message: JSON.stringify(geo, null, 2), title: `${trip.title} route` });
  };

  const exportPdf = async () => {
    if (!trip) return;
    await exportTripJournalPdf(trip);
  };

  const shareTripLink = async () => {
    if (!trip) return;
    await copyShareTrip(trip);
    await load();
  };

  const toggleVoiceRecording = async () => {
    try {
      if (!recordingVoice) {
        const now = new Date().toISOString();
        const entryId = uuid();
        await upsertEntry({
          id: entryId,
          trip_id: tripId,
          recorded_at: now,
          body: entryText.trim() || '🎙 Voice note',
          mood: mood || null,
          place_name: place || null,
          weather: null,
          sync_status: 'pending',
          updated_at: now,
        });
        setVoiceEntryId(entryId);
        await startVoiceRecording();
        setRecordingVoice(true);
      } else if (voiceEntryId) {
        await stopVoiceRecordingAndSave(tripId, voiceEntryId);
        setRecordingVoice(false);
        setVoiceEntryId(null);
        setEntryText('');
        await load();
      }
    } catch (e) {
      Alert.alert('Voice note', e instanceof Error ? e.message : 'Could not record');
      setRecordingVoice(false);
    }
  };

  const markComplete = async () => {
    if (!trip) return;
    await upsertTrip({
      ...trip,
      status: 'completed',
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    });
    await load();
  };

  const confirmDelete = () => {
    Alert.alert('Delete trip', 'This removes all journal data on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTrip(tripId);
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const addExpense = async () => {
    const amount = Number(expAmount);
    if (!amount) return;
    const now = new Date().toISOString();
    await upsertExpense({
      id: uuid(),
      trip_id: tripId,
      category: expCategory,
      amount,
      currency: 'INR',
      note: null,
      spent_on: now.slice(0, 10),
      sync_status: 'pending',
      updated_at: now,
    });
    setExpAmount('');
    await load();
  };

  const togglePacked = async (item: LocalPackingItem) => {
    await upsertPackingItem({
      ...item,
      packed: item.packed ? 0 : 1,
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    });
    await load();
  };

  const toggleTracking = async () => {
    try {
      if (tracking) {
        await stopTripTracking();
        setTracking(false);
      } else {
        await startTripTracking(tripId);
        setTracking(true);
      }
    } catch (e) {
      Alert.alert('Location', e instanceof Error ? e.message : 'Could not start tracking');
    }
    await load();
  };

  if (!trip) return <Text style={{ padding: 16 }}>Loading…</Text>;

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const packedCount = packing.filter(p => p.packed).length;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, backgroundColor: paperTheme.colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text variant="headlineSmall">{trip.title}</Text>
          <Text style={{ color: '#57534e' }}>{trip.destination} · {trip.trip_type}</Text>
          {trip.status === 'completed' ? <Chip compact style={{ alignSelf: 'flex-start', marginTop: 8 }}>Completed</Chip> : null}
        </View>
        <Menu visible={menuOpen} onDismiss={() => setMenuOpen(false)} anchor={<IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} />}>
          <Menu.Item onPress={() => { setMenuOpen(false); shareTripLink(); }} title="Share read-only link" />
          <Menu.Item onPress={() => { setMenuOpen(false); exportPdf(); }} title="Export PDF journal" />
          <Menu.Item onPress={() => { setMenuOpen(false); markComplete(); }} title="Mark trip complete" />
          <Menu.Item onPress={() => { setMenuOpen(false); confirmDelete(); }} title="Delete trip" />
        </Menu>
      </View>
      <Card style={{ marginVertical: 12, backgroundColor: paperTheme.colors.surface }}>
        <Card.Content>
          <Text style={{ color: '#44403c' }}>{synopsis}</Text>
          {trip.notes ? <Text style={{ marginTop: 8, fontSize: 13, color: '#78716c' }}>{trip.notes}</Text> : null}
        </Card.Content>
      </Card>
      <SegmentedButtons
        value={tab}
        onValueChange={v => setTab(v as Tab)}
        buttons={[
          { value: 'journal', label: 'Journal' },
          { value: 'budget', label: 'Budget' },
          { value: 'packing', label: `Pack ${packedCount}/${packing.length}` },
          { value: 'route', label: 'Route' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {tab === 'journal' && (
        <View>
          {entries.map(e => (
            <Card key={e.id} style={{ marginBottom: 12, backgroundColor: paperTheme.colors.surface }}>
              <Card.Content>
                <Text variant="labelSmall">{new Date(e.recorded_at).toLocaleString()}</Text>
                {e.place_name ? <Text style={{ color: '#0f766e', fontWeight: '600' }}>{e.place_name}</Text> : null}
                <Text style={{ marginTop: 6, lineHeight: 22 }}>{e.body}</Text>
                {e.mood ? <Text style={{ marginTop: 6, color: '#57534e' }}>{e.mood}</Text> : null}
                {e.weather ? <Text style={{ marginTop: 4, fontSize: 12, color: '#78716c' }}>☁ {e.weather}</Text> : null}
                <EntryMediaStrip entryId={e.id} />
                <EntryVoiceNotes entryId={e.id} />
                <Button mode="text" compact onPress={() => attachPhotoToEntry(e.id)}>Add photo</Button>
              </Card.Content>
            </Card>
          ))}
          <Text variant="titleSmall" style={{ marginBottom: 8 }}>New entry</Text>
          <TextInput label="What happened?" value={entryText} onChangeText={setEntryText} multiline mode="outlined" style={{ marginBottom: 8 }} />
          <TextInput label="Place" value={place} onChangeText={setPlace} mode="outlined" style={{ marginBottom: 8 }} />
          <MoodChips value={mood} onChange={setMood} />
          <Chip selected={useLocationWeather} onPress={() => setUseLocationWeather(!useLocationWeather)} style={{ marginBottom: 12 }} icon="weather-partly-cloudy">
            Attach weather from GPS
          </Chip>
          <Button mode="contained" onPress={addEntry}>Save entry</Button>
          <Button mode="outlined" style={{ marginTop: 8 }} onPress={addEntryWithPhoto}>Save + photo</Button>
          <Button
            mode={recordingVoice ? 'contained' : 'outlined'}
            style={{ marginTop: 8 }}
            icon="microphone"
            onPress={toggleVoiceRecording}
          >
            {recordingVoice ? 'Stop & save voice note' : 'Record voice note'}
          </Button>
        </View>
      )}

      {tab === 'budget' && (
        <View>
          <Card style={{ backgroundColor: '#fff', marginBottom: 12 }}>
            <Card.Content>
              <Text variant="headlineSmall">₹{totalSpend.toFixed(0)}</Text>
              <Text style={{ color: '#78716c' }}>Total on this trip</Text>
            </Card.Content>
          </Card>
          {expenses.map(e => (
            <Text key={e.id} style={{ marginBottom: 6 }}>{e.category}: ₹{e.amount}</Text>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
            {EXPENSE_CATS.map(c => (
              <Chip key={c} selected={expCategory === c} onPress={() => setExpCategory(c)} compact>{c}</Chip>
            ))}
          </View>
          <TextInput label="Amount (INR)" value={expAmount} onChangeText={setExpAmount} keyboardType="numeric" mode="outlined" style={{ marginBottom: 8 }} />
          <Button mode="contained" onPress={addExpense}>Add expense</Button>
        </View>
      )}

      {tab === 'packing' && (
        <View>
          {packing.map(item => (
            <Button key={item.id} mode={item.packed ? 'contained-tonal' : 'outlined'} onPress={() => togglePacked(item)} style={{ marginBottom: 6 }}>
              {item.packed ? '✓ ' : ''}{item.label}
            </Button>
          ))}
        </View>
      )}

      {tab === 'route' && (
        <View>
          <RouteMap points={routePoints} />
          <Text variant="bodyMedium">{points} GPS points · battery-aware sampling</Text>
          <Button mode="contained" style={{ marginTop: 12 }} onPress={toggleTracking}>
            {tracking ? 'Stop recording' : 'Start recording route'}
          </Button>
          <Button mode="outlined" style={{ marginTop: 8 }} onPress={exportRoute} disabled={points < 2}>
            Share GeoJSON
          </Button>
        </View>
      )}
    </ScrollView>
  );
}
