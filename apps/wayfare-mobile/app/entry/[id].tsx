import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { MoodChips } from '../../src/components/MoodChips';
import { useToast } from '../../src/context/ToastContext';
import { deleteEntry, getEntry, upsertEntry, type LocalEntry } from '../../src/lib/localDb';
import { useAppTheme } from '../../src/theme';
import { Screen } from '../../src/ui/Screen';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const toast = useToast();
  const [entry, setEntry] = useState<LocalEntry | null | undefined>(undefined);
  const [body, setBody] = useState('');
  const [place, setPlace] = useState('');
  const [mood, setMood] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getEntry(String(id)).then(e => {
      setEntry(e);
      if (e) {
        setBody(e.body ?? '');
        setPlace(e.place_name ?? '');
        setMood(e.mood ?? '');
      }
    });
  }, [id]);

  if (entry === undefined) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!entry) return <Text style={{ padding: 16 }}>This moment was deleted.</Text>;

  const save = async () => {
    setBusy(true);
    try {
      await upsertEntry({
        ...entry,
        body: body.trim() || null,
        place_name: place.trim() || null,
        mood: mood || null,
        sync_status: 'pending',
        updated_at: new Date().toISOString(),
      });
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete this moment?', 'Photos and voice notes in it are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(entry.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Text style={{ color: colors.muted, marginBottom: 10 }}>{new Date(entry.recorded_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(entry.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
      <View style={{ gap: 12 }}>
        <TextInput mode="outlined" label="What happened?" value={body} onChangeText={setBody} multiline style={{ minHeight: 140 }} />
        <TextInput mode="outlined" label="Place" value={place} onChangeText={setPlace} left={<TextInput.Icon icon="map-marker-outline" />} />
        <MoodChips value={mood} onChange={setMood} />
        <Button mode="contained" onPress={save} loading={busy} disabled={busy}>
          Save
        </Button>
        <Button textColor={colors.error} icon="delete-outline" onPress={remove}>
          Delete moment
        </Button>
      </View>
    </Screen>
  );
}
