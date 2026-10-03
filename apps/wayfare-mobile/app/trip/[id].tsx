import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { v4 as uuid } from 'uuid';
import {
  countTrackPoints,
  getTrip,
  listEntries,
  listExpenses,
  listPacking,
  upsertEntry,
  upsertExpense,
  upsertEntryMedia,
  upsertPackingItem,
  type LocalEntry,
  type LocalExpense,
  type LocalPackingItem,
  type LocalTrip,
} from '../../src/lib/localDb';
import { EntryMediaStrip } from '../../src/components/EntryMediaStrip';
import { buildTripGeoJson } from '../../src/lib/geoExport';
import { startTripTracking, stopTripTracking, getActiveTrackingTripId } from '../../src/lib/tracking';

type Tab = 'journal' | 'budget' | 'packing' | 'route';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const [tab, setTab] = useState<Tab>('journal');
  const [trip, setTrip] = useState<LocalTrip | null>(null);
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [packing, setPacking] = useState<LocalPackingItem[]>([]);
  const [points, setPoints] = useState(0);
  const [entryText, setEntryText] = useState('');
  const [mood, setMood] = useState('');
  const [place, setPlace] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('food');
  const [tracking, setTracking] = useState(false);

  const load = useCallback(async () => {
    setTrip(await getTrip(tripId));
    setEntries(await listEntries(tripId));
    setExpenses(await listExpenses(tripId));
    setPacking(await listPacking(tripId));
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

  const addEntry = async () => {
    if (!entryText.trim()) return;
    const now = new Date().toISOString();
    const entryId = uuid();
    await upsertEntry({
      id: entryId,
      trip_id: tripId,
      recorded_at: now,
      body: entryText.trim(),
      mood: mood || null,
      place_name: place || null,
      weather: null,
      sync_status: 'pending',
      updated_at: now,
    });
    setEntryText('');
    setMood('');
    setPlace('');
    await load();
    return entryId;
  };

  const addEntryWithOptionalPhoto = async () => {
    const entryId = await addEntry();
    if (entryId) await attachPhotoToEntry(entryId);
  };

  const exportRoute = async () => {
    if (!trip) return;
    const geo = await buildTripGeoJson(tripId, trip.title);
    await Share.share({
      message: JSON.stringify(geo, null, 2),
      title: `${trip.title} route`,
    });
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
    if (tracking) {
      await stopTripTracking();
      setTracking(false);
    } else {
      await startTripTracking(tripId);
      setTracking(true);
    }
    await load();
  };

  if (!trip) return <Text style={{ padding: 16 }}>Loading…</Text>;

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text variant="headlineSmall">{trip.title}</Text>
      <Text style={{ color: '#57534e', marginBottom: 12 }}>{trip.destination} · {trip.trip_type}</Text>
      <SegmentedButtons
        value={tab}
        onValueChange={v => setTab(v as Tab)}
        buttons={[
          { value: 'journal', label: 'Journal' },
          { value: 'budget', label: 'Budget' },
          { value: 'packing', label: 'Pack' },
          { value: 'route', label: 'Route' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {tab === 'journal' && (
        <View>
          {entries.map(e => (
            <View key={e.id} style={{ marginBottom: 12, padding: 12, backgroundColor: '#fff', borderRadius: 8 }}>
              <Text variant="labelSmall">{new Date(e.recorded_at).toLocaleString()}</Text>
              {e.place_name ? <Text style={{ color: '#0f766e' }}>{e.place_name}</Text> : null}
              <Text>{e.body}</Text>
              {e.mood ? <Text style={{ marginTop: 4, color: '#57534e' }}>Mood: {e.mood}</Text> : null}
              <EntryMediaStrip entryId={e.id} />
              <Button mode="text" compact onPress={() => attachPhotoToEntry(e.id)} style={{ alignSelf: 'flex-start' }}>
                Add photo
              </Button>
            </View>
          ))}
          <TextInput label="Journal entry" value={entryText} onChangeText={setEntryText} multiline style={{ marginBottom: 8 }} />
          <TextInput label="Place tag" value={place} onChangeText={setPlace} style={{ marginBottom: 8 }} />
          <TextInput label="Mood" value={mood} onChangeText={setMood} style={{ marginBottom: 8 }} />
          <Button mode="contained" onPress={addEntry}>Save entry</Button>
          <Button mode="outlined" style={{ marginTop: 8 }} onPress={addEntryWithOptionalPhoto}>
            Save entry + photo
          </Button>
        </View>
      )}

      {tab === 'budget' && (
        <View>
          <Text variant="titleMedium">Spent: ₹{totalSpend.toFixed(0)}</Text>
          {expenses.map(e => (
            <Text key={e.id} style={{ marginTop: 6 }}>{e.category}: ₹{e.amount}</Text>
          ))}
          <TextInput label="Amount (INR)" value={expAmount} onChangeText={setExpAmount} keyboardType="numeric" style={{ marginTop: 16, marginBottom: 8 }} />
          <TextInput label="Category" value={expCategory} onChangeText={setExpCategory} style={{ marginBottom: 8 }} />
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
          <Text>GPS points recorded: {points}</Text>
          <Text style={{ marginVertical: 8, color: '#57534e' }}>
            Route capture uses battery-aware sampling. Verification tiers are computed server-side in a later milestone.
          </Text>
          <Button mode="contained" onPress={toggleTracking}>
            {tracking ? 'Stop recording route' : 'Start recording route'}
          </Button>
          <Button mode="outlined" style={{ marginTop: 12 }} onPress={exportRoute} disabled={points < 2}>
            Export route (GeoJSON)
          </Button>
        </View>
      )}
    </ScrollView>
  );
}
