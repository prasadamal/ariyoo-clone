import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useSync } from '../../src/context/SyncContext';
import { getTrekById, PACKING_TEMPLATES } from '../../src/content/treks';
import { newId } from '../../src/lib/id';
import { getTrip, seedPackingTemplate, upsertTrip } from '../../src/lib/localDb';
import { LIMITS, validateTripForm } from '../../src/lib/validation';

const TRIP_TYPES = [
  { value: 'trek', label: 'Trek' },
  { value: 'road', label: 'Road trip' },
  { value: 'city', label: 'City' },
];

/** Create a trip, or edit one when `editId` is given. */
export default function TripFormScreen() {
  const theme = useTheme();
  const { notifyLocalChange } = useSync();
  const params = useLocalSearchParams<{ editId?: string; trekId?: string; title?: string; destination?: string; tripType?: string }>();
  const editId = params.editId ? String(params.editId) : null;

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [tripType, setTripType] = useState('trek');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [companions, setCompanions] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (editId) {
        const t = await getTrip(editId);
        if (!t) return;
        setTitle(t.title);
        setDestination(t.destination ?? '');
        setTripType(t.trip_type);
        setStartsOn(t.starts_on ?? '');
        setEndsOn(t.ends_on ?? '');
        setCompanions(t.companions ?? '');
        setNotes(t.notes ?? '');
        return;
      }
      if (params.title) setTitle(String(params.title));
      if (params.destination) setDestination(String(params.destination));
      if (params.tripType) setTripType(String(params.tripType));
      const trek = params.trekId ? getTrekById(String(params.trekId)) : undefined;
      if (trek) setNotes(`Best season: ${trek.bestSeason}\nPermits: ${trek.permits}\nTransport: ${trek.transport}`);
    })();
  }, [editId, params.trekId, params.title, params.destination, params.tripType]);

  const save = async () => {
    const problem = validateTripForm({ title, destination, startsOn, endsOn, companions, notes });
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const fields = {
        title: title.trim(),
        trip_type: tripType,
        destination: destination.trim() || null,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
        companions: companions.trim() || null,
        notes: notes.trim() || null,
      };
      if (editId) {
        const existing = await getTrip(editId);
        if (!existing) throw new Error('This trip no longer exists.');
        await upsertTrip({ ...existing, ...fields, sync_status: 'pending', updated_at: now });
        notifyLocalChange();
        router.back();
        return;
      }
      const id = newId();
      await upsertTrip({ id, ...fields, visibility: 'private', status: 'active', share_id: null, sync_status: 'pending', updated_at: now });
      await seedPackingTemplate(id, PACKING_TEMPLATES[tripType] ?? PACKING_TEMPLATES.trek);
      notifyLocalChange();
      router.replace(`/trip/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the trip.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editId ? 'Edit trip' : 'New trip' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>Works offline — it syncs when you are signed in.</Text>
        {error ? <StatusBanner kind="error">{error}</StatusBanner> : null}
        <TextInput label="Trip title" value={title} onChangeText={setTitle} style={{ marginBottom: 12 }} mode="outlined" maxLength={LIMITS.title} />
        <TextInput label="Destination" value={destination} onChangeText={setDestination} style={{ marginBottom: 12 }} mode="outlined" maxLength={LIMITS.destination} />
        <Text style={{ marginBottom: 8 }}>Trip type</Text>
        <SegmentedButtons value={tripType} onValueChange={setTripType} buttons={TRIP_TYPES} style={{ marginBottom: 16 }} />
        <TextInput label="Start date (YYYY-MM-DD)" value={startsOn} onChangeText={setStartsOn} style={{ marginBottom: 12 }} mode="outlined" keyboardType="numbers-and-punctuation" placeholder="2026-12-24" maxLength={10} />
        <TextInput label="End date (YYYY-MM-DD)" value={endsOn} onChangeText={setEndsOn} style={{ marginBottom: 12 }} mode="outlined" keyboardType="numbers-and-punctuation" placeholder="2026-12-30" maxLength={10} />
        <TextInput label="Companions" value={companions} onChangeText={setCompanions} style={{ marginBottom: 12 }} mode="outlined" maxLength={LIMITS.companions} />
        <TextInput label="Notes & permits" value={notes} onChangeText={setNotes} multiline style={{ marginBottom: 16, minHeight: 90 }} mode="outlined" maxLength={LIMITS.notes} />
        <Button mode="contained" onPress={save} loading={saving} disabled={saving || !title.trim()}>
          {editId ? 'Save changes' : 'Create trip'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
