import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { v4 as uuid } from 'uuid';
import { getTrekById, PACKING_TEMPLATES } from '../../src/content/treks';
import { seedPackingTemplate, upsertTrip } from '../../src/lib/localDb';

const TRIP_TYPES = [
  { value: 'trek', label: 'Trek' },
  { value: 'road', label: 'Road' },
  { value: 'city', label: 'City' },
];

export default function NewTripScreen() {
  const params = useLocalSearchParams<{ trekId?: string; title?: string; destination?: string; tripType?: string }>();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [tripType, setTripType] = useState('trek');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [companions, setCompanions] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (params.title) setTitle(String(params.title));
    if (params.destination) setDestination(String(params.destination));
    if (params.tripType) setTripType(String(params.tripType));
    const trek = params.trekId ? getTrekById(String(params.trekId)) : undefined;
    if (trek) {
      setNotes(
        `Best season: ${trek.bestSeason}\nPermits: ${trek.permits}\nTransport: ${trek.transport}`
      );
    }
  }, [params.trekId, params.title, params.destination, params.tripType]);

  const create = async () => {
    if (!title.trim()) return;
    setLoading(true);
    const id = uuid();
    const now = new Date().toISOString();
    await upsertTrip({
      id,
      title: title.trim(),
      trip_type: tripType,
      destination: destination.trim() || null,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      visibility: 'private',
      companions: companions.trim() || null,
      status: 'active',
      notes: notes.trim() || null,
      share_id: null,
      sync_status: 'pending',
      updated_at: now,
    });
    const template = PACKING_TEMPLATES[tripType] ?? PACKING_TEMPLATES.trek;
    await seedPackingTemplate(id, template);
    setLoading(false);
    router.replace(`/trip/${id}`);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text variant="titleLarge" style={{ marginBottom: 4 }}>New trip</Text>
      <Text style={{ color: '#57534e', marginBottom: 16 }}>Works offline—sync when you sign in.</Text>
      <TextInput label="Trip title" value={title} onChangeText={setTitle} style={{ marginBottom: 12 }} mode="outlined" />
      <TextInput label="Destination" value={destination} onChangeText={setDestination} style={{ marginBottom: 12 }} mode="outlined" />
      <Text style={{ marginBottom: 8 }}>Trip type</Text>
      <SegmentedButtons value={tripType} onValueChange={setTripType} buttons={TRIP_TYPES} style={{ marginBottom: 16 }} />
      <TextInput label="Start date (YYYY-MM-DD)" value={startsOn} onChangeText={setStartsOn} style={{ marginBottom: 12 }} mode="outlined" />
      <TextInput label="End date (YYYY-MM-DD)" value={endsOn} onChangeText={setEndsOn} style={{ marginBottom: 12 }} mode="outlined" />
      <TextInput label="Companions" value={companions} onChangeText={setCompanions} style={{ marginBottom: 12 }} mode="outlined" />
      <TextInput label="Notes & permits" value={notes} onChangeText={setNotes} multiline style={{ marginBottom: 16 }} mode="outlined" />
      <Button mode="contained" onPress={create} loading={loading} disabled={!title.trim()}>Create trip</Button>
    </ScrollView>
  );
}
