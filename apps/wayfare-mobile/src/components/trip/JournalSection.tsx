import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Chip, Dialog, IconButton, Menu, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { newId } from '../../lib/id';
import {
  deleteEntry,
  upsertEntry,
  upsertEntryMedia,
  type LocalEntry,
} from '../../lib/localDb';
import { deleteLocalFiles, persistLocalFile } from '../../lib/media';
import { normalizeMime } from '../../lib/mediaTypes';
import { LIMITS } from '../../lib/validation';
import { MicPermissionError, saveVoiceNote, useVoiceNoteRecorder } from '../../lib/voiceNote';
import { fetchWeatherSummary } from '../../lib/weather';
import { EntryMediaStrip } from '../EntryMediaStrip';
import { EntryVoiceNotes } from '../EntryVoiceNotes';
import { MoodChips } from '../MoodChips';

type Props = { tripId: string; entries: LocalEntry[]; onChanged: () => void };

async function currentWeather(): Promise<string | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
    ]);
    return loc ? await fetchWeatherSummary(loc.coords.latitude, loc.coords.longitude) : null;
  } catch {
    return null;
  }
}

export function JournalSection({ tripId, entries, onChanged }: Props) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [place, setPlace] = useState('');
  const [mood, setMood] = useState('');
  const [attachWeather, setAttachWeather] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<LocalEntry | null>(null);
  const voice = useVoiceNoteRecorder();

  const attachPhotos = async (entryId: string) => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.7,
    });
    if (picked.canceled) return;
    for (const asset of picked.assets) {
      const mime = normalizeMime(asset.mimeType, asset.uri, 'photo');
      try {
        const { uri, size } = persistLocalFile(asset.uri, mime);
        await upsertEntryMedia({
          id: newId(),
          trip_id: tripId,
          entry_id: entryId,
          local_uri: uri,
          storage_path: null,
          mime_type: mime,
          kind: 'photo',
          size_bytes: size,
          sync_status: 'pending',
          updated_at: new Date().toISOString(),
        });
      } catch {
        Alert.alert('Photo not added', 'Could not save that photo on this device. Is storage full?');
      }
    }
    onChanged();
  };

  const createEntry = async (body: string): Promise<string> => {
    const now = new Date().toISOString();
    const id = newId();
    await upsertEntry({
      id,
      trip_id: tripId,
      recorded_at: now,
      body,
      mood: mood || null,
      place_name: place.trim() || null,
      weather: attachWeather ? await currentWeather() : null,
      sync_status: 'pending',
      updated_at: now,
    });
    return id;
  };

  const resetForm = () => {
    setText('');
    setPlace('');
    setMood('');
  };

  const save = async (withPhoto: boolean) => {
    const body = text.trim();
    if (!body) {
      Alert.alert('Nothing to save', 'Write a few words about your day first.');
      return;
    }
    if (body.length > LIMITS.entryBody) {
      Alert.alert('Entry too long', `Please keep entries under ${LIMITS.entryBody.toLocaleString()} characters.`);
      return;
    }
    setSaving(true);
    try {
      const id = await createEntry(body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      resetForm();
      onChanged();
      if (withPhoto) await attachPhotos(id);
    } finally {
      setSaving(false);
    }
  };

  const toggleVoice = async () => {
    try {
      if (!voice.recording) {
        await voice.start();
        return;
      }
      const uri = await voice.stop();
      if (!uri) return;
      const id = await createEntry(text.trim() || '🎙 Voice note');
      await saveVoiceNote(tripId, id, uri);
      resetForm();
      onChanged();
    } catch (e) {
      Alert.alert(
        e instanceof MicPermissionError ? 'Microphone needed' : 'Voice note',
        e instanceof Error ? e.message : 'Could not record.'
      );
    }
  };

  const confirmDelete = (entry: LocalEntry) =>
    Alert.alert('Delete entry', 'This removes the entry, its photos and voice notes everywhere.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          deleteLocalFiles(await deleteEntry(entry.id));
          onChanged();
        },
      },
    ]);

  return (
    <View>
      {entries.length === 0 ? (
        <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
          No entries yet. Capture what you are seeing, feeling and eating — it takes ten seconds.
        </Text>
      ) : null}

      {[...entries].reverse().map(e => (
        <Card key={e.id} style={{ marginBottom: 12 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="labelSmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>
                {new Date(e.recorded_at).toLocaleString()}
                {e.sync_status === 'pending' ? '  ·  waiting to sync' : ''}
              </Text>
              <Menu
                visible={menuFor === e.id}
                onDismiss={() => setMenuFor(null)}
                anchor={<IconButton icon="dots-horizontal" size={20} onPress={() => setMenuFor(e.id)} accessibilityLabel="Entry actions" />}
              >
                <Menu.Item leadingIcon="pencil" title="Edit" onPress={() => { setMenuFor(null); setEditing(e); }} />
                <Menu.Item leadingIcon="image-plus" title="Add photos" onPress={() => { setMenuFor(null); attachPhotos(e.id); }} />
                <Menu.Item leadingIcon="delete-outline" title="Delete" onPress={() => { setMenuFor(null); confirmDelete(e); }} />
              </Menu>
            </View>
            {e.place_name ? <Text style={{ color: theme.colors.secondary, fontWeight: '600' }}>{e.place_name}</Text> : null}
            <Text style={{ marginTop: 6, lineHeight: 22 }}>{e.body}</Text>
            {e.mood ? <Text style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>{e.mood}</Text> : null}
            {e.weather ? <Text style={{ marginTop: 4, fontSize: 12, color: theme.colors.onSurfaceVariant }}>☁ {e.weather}</Text> : null}
            <EntryMediaStrip entryId={e.id} />
            <EntryVoiceNotes entryId={e.id} />
          </Card.Content>
        </Card>
      ))}

      <Text variant="titleSmall" style={{ marginVertical: 8 }}>New entry</Text>
      <TextInput label="What happened?" value={text} onChangeText={setText} multiline mode="outlined" style={{ marginBottom: 8, minHeight: 90 }} maxLength={LIMITS.entryBody} />
      <TextInput label="Place (optional)" value={place} onChangeText={setPlace} mode="outlined" style={{ marginBottom: 8 }} maxLength={LIMITS.place} />
      <MoodChips value={mood} onChange={setMood} />
      <Chip
        selected={attachWeather}
        onPress={() => setAttachWeather(!attachWeather)}
        style={{ marginBottom: 12, alignSelf: 'flex-start' }}
        icon="weather-partly-cloudy"
      >
        Attach weather from my location
      </Chip>
      <Button mode="contained" onPress={() => save(false)} loading={saving} disabled={saving || voice.recording}>
        Save entry
      </Button>
      <Button mode="outlined" style={{ marginTop: 8 }} icon="image-plus" onPress={() => save(true)} disabled={saving || voice.recording}>
        Save and add photos
      </Button>
      <Button
        mode={voice.recording ? 'contained' : 'outlined'}
        buttonColor={voice.recording ? theme.colors.error : undefined}
        style={{ marginTop: 8 }}
        icon={voice.recording ? 'stop' : 'microphone'}
        onPress={toggleVoice}
        disabled={saving}
      >
        {voice.recording ? 'Stop and save voice note' : 'Record voice note'}
      </Button>

      <EditEntryDialog entry={editing} onDismiss={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />
    </View>
  );
}

function EditEntryDialog({ entry, onDismiss, onSaved }: { entry: LocalEntry | null; onDismiss: () => void; onSaved: () => void }) {
  const [body, setBody] = useState('');
  const [place, setPlace] = useState('');
  const [mood, setMood] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (entry && loadedFor !== entry.id) {
    setLoadedFor(entry.id);
    setBody(entry.body ?? '');
    setPlace(entry.place_name ?? '');
    setMood(entry.mood ?? '');
  }
  if (!entry && loadedFor) setLoadedFor(null);

  const save = async () => {
    if (!entry) return;
    if (!body.trim()) {
      Alert.alert('Entry is empty', 'Write something, or delete the entry instead.');
      return;
    }
    await upsertEntry({
      ...entry,
      body: body.trim(),
      place_name: place.trim() || null,
      mood: mood || null,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    });
    onSaved();
  };

  return (
    <Portal>
      <Dialog visible={!!entry} onDismiss={onDismiss}>
        <Dialog.Title>Edit entry</Dialog.Title>
        <Dialog.ScrollArea style={{ maxHeight: 420, paddingHorizontal: 16 }}>
          <View style={{ paddingVertical: 8 }}>
            <TextInput label="Entry" value={body} onChangeText={setBody} multiline mode="outlined" style={{ marginBottom: 8, minHeight: 100 }} maxLength={LIMITS.entryBody} />
            <TextInput label="Place" value={place} onChangeText={setPlace} mode="outlined" style={{ marginBottom: 8 }} maxLength={LIMITS.place} />
            <MoodChips value={mood} onChange={setMood} />
          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={save}>Save</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
