import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { v4 as uuid } from 'uuid';
import { PACKING_TEMPLATES } from '../../src/content/treks';
import { seedPackingTemplate, upsertTrip } from '../../src/lib/localDb';

const TRIP_TYPES = [
  { value: 'trek', label: 'Trek' },
  { value: 'road', label: 'Road' },
  { value: 'city', label: 'City' },
];

export default function NewTripScreen() {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [tripType, setTripType] = useState('trek');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [companions, setCompanions] = useState('');
  const [loading, setLoading] = useState(false);

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
      notes: null,
      sync_status: 'pending',
      updated_at: now,
    });
    const template = PACKING_TEMPLATES[tripType] ?? PACKING_TEMPLATES.trek;
    await seedPackingTemplate(id, template);
    setLoading(false);
    router.replace(`/trip/${id}`);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text variant="titleLarge" style={{ marginBottom: 16 }}>Trip wizard</Text>
      <TextInput label="Trip title" value={title} onChangeText={setTitle} style={{ marginBottom: 12 }} />
      <TextInput label="Destination" value={destination} onChangeText={setDestination} style={{ marginBottom: 12 }} />
      <Text style={{ marginBottom: 8 }}>Trip type</Text>
      <SegmentedButtons value={tripType} onValueChange={setTripType} buttons={TRIP_TYPES} style={{ marginBottom: 16 }} />
      <TextInput label="Start date (YYYY-MM-DD)" value={startsOn} onChangeText={setStartsOn} style={{ marginBottom: 12 }} />
      <TextInput label="End date (YYYY-MM-DD)" value={endsOn} onChangeText={setEndsOn} style={{ marginBottom: 12 }} />
      <TextInput label="Companions" value={companions} onChangeText={setCompanions} style={{ marginBottom: 16 }} />
      <Button mode="contained" onPress={create} loading={loading} disabled={!title.trim()}>Create trip</Button>
    </ScrollView>
  );
}
