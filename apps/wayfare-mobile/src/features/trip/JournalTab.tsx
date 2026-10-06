import { useAudioRecorder } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Chip, IconButton, Menu, Text, TextInput } from 'react-native-paper';
import { uuid } from '../../lib/id';
import { EntryMediaStrip } from '../../components/EntryMediaStrip';
import { EntryVoiceNotes } from '../../components/EntryVoiceNotes';
import { MoodChips } from '../../components/MoodChips';
import { useCanConnect } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDay, toDayString } from '../../lib/format';
import { deleteEntry, listEntries, upsertEntry, upsertEntryMedia, type LocalEntry, type LocalTrip } from '../../lib/localDb';
import { persistJournalPhoto } from '../../lib/media';
import { VOICE_NOTE_PRESET, cancelVoiceRecording, startVoiceRecording, stopVoiceRecordingAndSave } from '../../lib/voiceNote';
import { fetchWeatherSummary } from '../../lib/weather';
import { useAppTheme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { pickPhotos, type PickedPhoto } from './photoPicker';

type Props = { trip: LocalTrip; onChanged: () => void };

async function currentFix() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 200 });
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return pos.coords;
}

export function JournalTab({ trip, onChanged }: Props) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const canConnect = useCanConnect();
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [text, setText] = useState('');
  const [place, setPlace] = useState('');
  const [mood, setMood] = useState('');
  const [attachContext, setAttachContext] = useState(true);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);
  const recorder = useAudioRecorder(VOICE_NOTE_PRESET);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [mediaKey, setMediaKey] = useState(0);

  const load = useCallback(async () => {
    setEntries(await listEntries(trip.id));
  }, [trip.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () => () => {
      cancelVoiceRecording(recorder);
    },
    [recorder]
  );

  const attachPhotos = async (entryId: string, picked: PickedPhoto[]) => {
    for (const p of picked) {
      const mediaId = uuid();
      const stored = await persistJournalPhoto(p.uri, mediaId, p);
      await upsertEntryMedia({
        id: mediaId,
        trip_id: trip.id,
        entry_id: entryId,
        local_uri: stored.uri,
        storage_path: null,
        mime_type: stored.mimeType,
        sync_status: 'pending',
        updated_at: new Date().toISOString(),
      });
    }
  };

  const createEntry = async (body: string) => {
    const now = new Date().toISOString();
    let weather: string | null = null;
    let coords: Location.LocationObjectCoords | null = null;
    if (attachContext) {
      try {
        coords = await currentFix();
        if (coords) weather = await fetchWeatherSummary(coords.latitude, coords.longitude);
      } catch {
        // offline / no fix — the entry still saves
      }
    }
    const entry: LocalEntry = {
      id: uuid(),
      trip_id: trip.id,
      recorded_at: now,
      body,
      mood: mood || null,
      place_name: place.trim() || null,
      weather,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      altitude_m: coords?.altitude ?? null,
      sync_status: 'pending',
      updated_at: now,
    };
    await upsertEntry(entry);
    return entry;
  };

  const save = async () => {
    if (!text.trim() && !photos.length) return;
    setSaving(true);
    try {
      const entry = await createEntry(text.trim() || '📷');
      if (photos.length) await attachPhotos(entry.id, photos);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setText('');
      setPlace('');
      setMood('');
      setPhotos([]);
      await load();
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save entry');
    } finally {
      setSaving(false);
    }
  };

  const addPhotosToDraft = async () => {
    try {
      const picked = await pickPhotos(true);
      if (picked.length) setPhotos(prev => [...prev, ...picked].slice(0, 10));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add photos');
    }
  };

  const addPhotosToEntry = async (entryId: string) => {
    try {
      const picked = await pickPhotos(true);
      if (!picked.length) return;
      await attachPhotos(entryId, picked);
      setMediaKey(k => k + 1);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add photos');
    }
  };

  const toggleVoice = async () => {
    // The entry this clip belongs to; removed again if recording fails.
    let entryId = recording;
    try {
      if (!entryId) {
        const entry = await createEntry(text.trim() || '🎙 Voice note');
        entryId = entry.id;
        await startVoiceRecording(recorder);
        setRecording(entry.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      } else {
        await stopVoiceRecordingAndSave(recorder, trip.id, entryId);
        setRecording(null);
        setText('');
        setMediaKey(k => k + 1);
        await load();
        onChanged();
      }
    } catch (e) {
      await cancelVoiceRecording(recorder);
      if (entryId) await deleteEntry(entryId).catch(() => undefined);
      setRecording(null);
      await load();
      toast(e instanceof Error ? e.message : 'Could not record');
    }
  };

  const remove = (e: LocalEntry) =>
    Alert.alert('Delete this moment?', 'Photos and voice notes in it are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(e.id);
          await load();
          onChanged();
        },
      },
    ]);

  // Newest first, grouped by calendar day with "Day n" relative to the trip start.
  const groups = useMemo(() => {
    const byDay = new Map<string, LocalEntry[]>();
    for (const e of [...entries].reverse()) {
      const day = toDayString(new Date(e.recorded_at));
      byDay.set(day, [...(byDay.get(day) ?? []), e]);
    }
    const start = trip.starts_on ? new Date(`${trip.starts_on}T00:00:00`) : entries[0] ? new Date(toDayString(new Date(entries[0].recorded_at)) + 'T00:00:00') : null;
    return [...byDay.entries()].map(([day, list]) => {
      const n = start ? Math.round((new Date(`${day}T00:00:00`).getTime() - start.getTime()) / 86400000) + 1 : null;
      return { day, label: `${n && n > 0 ? `Day ${n} · ` : ''}${formatDay(day, { weekday: true })}`, list };
    });
  }, [entries, trip.starts_on]);

  return (
    <View>
      <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 16 }}>
        <TextInput
          mode="flat"
          placeholder="What happened? Sights, people, feelings…"
          value={text}
          onChangeText={setText}
          multiline
          style={{ backgroundColor: 'transparent', minHeight: 70 }}
          underlineColor="transparent"
        />
        <TextInput
          mode="flat"
          placeholder="Place (optional)"
          value={place}
          onChangeText={setPlace}
          dense
          left={<TextInput.Icon icon="map-marker-outline" />}
          style={{ backgroundColor: 'transparent' }}
          underlineColor="transparent"
        />
        <MoodChips value={mood} onChange={setMood} />
        {photos.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {photos.map((p, i) => (
              <Chip key={p.uri + i} icon="image" onClose={() => setPhotos(photos.filter((_, j) => j !== i))} compact>
                Photo {i + 1}
              </Chip>
            ))}
          </View>
        ) : null}
        <Chip
          selected={attachContext}
          onPress={() => setAttachContext(!attachContext)}
          icon={attachContext ? 'map-marker-check' : 'map-marker-off'}
          compact
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        >
          {attachContext ? 'Add location, altitude & weather' : 'No location'}
        </Chip>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 }}>
          <IconButton icon="camera-plus-outline" onPress={addPhotosToDraft} accessibilityLabel="Add photos" disabled={!!recording} />
          <IconButton
            icon={recording ? 'stop-circle' : 'microphone-outline'}
            iconColor={recording ? colors.danger : undefined}
            onPress={toggleVoice}
            accessibilityLabel={recording ? 'Stop and save voice note' : 'Record a voice note'}
          />
          {recording ? <Text style={{ color: colors.danger, fontWeight: '700' }}>● Recording…</Text> : null}
          <View style={{ flex: 1 }} />
          <Button mode="contained" onPress={save} loading={saving} disabled={saving || !!recording || (!text.trim() && !photos.length)}>
            Save moment
          </Button>
        </View>
      </View>

      {!groups.length ? (
        <EmptyState compact icon="feather" title="Your first moment" body="Write a line, add a photo or record a voice note. It all works offline." />
      ) : null}

      {groups.map(g => (
        <View key={g.day}>
          <Text style={{ color: colors.secondary, fontWeight: '800', fontSize: 12, letterSpacing: 0.6, marginBottom: 8, marginTop: 4 }}>
            {g.label.toUpperCase()}
          </Text>
          {g.list.map(e => (
            <View key={e.id} style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {new Date(e.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {e.sync_status === 'pending' ? ' · not synced yet' : ''}
                  </Text>
                  {e.place_name ? <Text style={{ color: colors.secondary, fontWeight: '700' }}>{e.place_name}</Text> : null}
                </View>
                <Menu
                  visible={menuFor === e.id}
                  onDismiss={() => setMenuFor(null)}
                  anchor={<IconButton icon="dots-vertical" size={18} onPress={() => setMenuFor(e.id)} accessibilityLabel="Moment options" />}
                >
                  <Menu.Item leadingIcon="pencil-outline" title="Edit" onPress={() => { setMenuFor(null); router.push(`/entry/${e.id}`); }} />
                  <Menu.Item leadingIcon="image-plus" title="Add photos" onPress={() => { setMenuFor(null); addPhotosToEntry(e.id); }} />
                  {canConnect ? (
                    <Menu.Item
                      leadingIcon="share-variant-outline"
                      title="Share to feed"
                      onPress={() => {
                        setMenuFor(null);
                        router.push({ pathname: '/post/new', params: { entryId: e.id, tripId: trip.id } });
                      }}
                    />
                  ) : null}
                  <Menu.Item leadingIcon="delete-outline" title="Delete" onPress={() => { setMenuFor(null); remove(e); }} />
                </Menu>
              </View>
              {e.body ? <Text style={{ marginTop: 6, lineHeight: 22 }}>{e.body}</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {e.mood ? <Text style={{ color: colors.onSurfaceVariant }}>{e.mood}</Text> : null}
                {e.weather ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    <Icon name="weather-partly-cloudy" size={12} color={colors.muted} /> {e.weather}
                  </Text>
                ) : null}
                {e.altitude_m != null ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    <Icon name="image-filter-hdr" size={12} color={colors.muted} /> {Math.round(e.altitude_m).toLocaleString('en-IN')} m
                  </Text>
                ) : null}
              </View>
              <EntryMediaStrip entryId={e.id} refreshKey={mediaKey} onChanged={onChanged} />
              <EntryVoiceNotes entryId={e.id} refreshKey={mediaKey} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
