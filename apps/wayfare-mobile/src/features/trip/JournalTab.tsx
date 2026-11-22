import { useAudioRecorder } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { uuid } from '../../lib/id';
import { useCanConnect, useSocial } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDay, toDayString } from '../../lib/format';
import { deleteEntry, listEntries, listExpenses, upsertEntry, upsertEntryMedia, upsertExpense, type LocalEntry, type LocalExpense, type LocalTrip } from '../../lib/localDb';
import { currencySymbol } from '../../lib/currencyMath';
import { totalsByMoment } from '../../lib/momentMoney';
import { persistJournalPhoto } from '../../lib/media';
import { VOICE_NOTE_PRESET, cancelVoiceRecording, startVoiceRecording, stopVoiceRecordingAndSave } from '../../lib/voiceNote';
import { fetchWeatherSummary } from '../../lib/weather';
import { useAppTheme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { MomentCard } from './MomentCard';
import { MomentComposer, type MomentMoney } from './MomentComposer';
import { pickPhotos, type PickedPhoto } from './photoPicker';
import { Pill } from '../../ui/Pill';

/** `everyday` is the private journal for ordinary days: no "Day n" counter, a daily prompt. */
const DAYS_PER_PAGE = 30;

type Props = { trip: LocalTrip; onChanged: () => void; everyday?: boolean };

async function currentFix() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 200 });
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return pos.coords;
}

export function JournalTab({ trip, onChanged, everyday = false }: Props) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const canConnect = useCanConnect();
  const social = useSocial();
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [text, setText] = useState('');
  const [mood, setMood] = useState('');
  // Location and weather are added only when the person taps the location icon.
  const [attachContext, setAttachContext] = useState(false);
  const [money, setMoney] = useState<MomentMoney | null>(null);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const voiceLock = useRef(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);
  const recorder = useAudioRecorder(VOICE_NOTE_PRESET);
  const [mediaKey, setMediaKey] = useState(0);
  // Years of daily pages would render all at once; show recent days and load older ones on request.
  const [shownDays, setShownDays] = useState(DAYS_PER_PAGE);

  const load = useCallback(async () => {
    setEntries(await listEntries(trip.id));
    setExpenses(await listExpenses(trip.id));
  }, [trip.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () => () => {
      void cancelVoiceRecording(recorder).catch(() => undefined);
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

  /** The money typed into the composer becomes an expense tied to this moment. */
  const attachMoney = async (entryId: string) => {
    if (!money) return;
    const when = new Date().toISOString();
    await upsertExpense({
      id: uuid(),
      trip_id: trip.id,
      category: money.category,
      amount: money.amount,
      currency: trip.currency || 'INR',
      note: null,
      spent_on: when.slice(0, 10),
      paid_by: null,
      split_with: '[]',
      entry_id: entryId,
      sync_status: 'pending',
      updated_at: when,
    });
  };

  const createEntry = async (body: string, withMoney = true) => {
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
      place_name: null,
      weather,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      altitude_m: coords?.altitude ?? null,
      sync_status: 'pending',
      updated_at: now,
    };
    await upsertEntry(entry);
    if (withMoney) await attachMoney(entry.id);
    return entry;
  };

  const save = async () => {
    if (!text.trim() && !photos.length && !money) return;
    setSaving(true);
    try {
      const entry = await createEntry(text.trim() || (photos.length ? '📷' : '💰'));
      if (photos.length) await attachPhotos(entry.id, photos);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setText('');
      setMood('');
      setPhotos([]);
      setMoney(null);
      setAttachContext(false);
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
    if (voiceLock.current) return;
    voiceLock.current = true;
    setVoiceBusy(true);
    let entryId = recording;
    let createdNew = false;
    try {
      if (!entryId) {
        // Money waits in the box for the next normal save; a failed recording must not leave it behind.
        const entry = await createEntry(text.trim() || '🎙 Voice note', false);
        entryId = entry.id;
        createdNew = true;
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
      await cancelVoiceRecording(recorder).catch(() => undefined);
      if (createdNew && entryId) await deleteEntry(entryId).catch(() => undefined);
      setRecording(null);
      await load();
      toast(e instanceof Error ? e.message : 'Could not record');
    } finally {
      voiceLock.current = false;
      setVoiceBusy(false);
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
  // Oldest first, like reading a diary. Journeys group by "Day 1, Day 2…" from the start date (or the
  // first moment); the everyday journal groups by date. Each moment shows its own date and time.
  const groups = useMemo(() => {
    const byDay = new Map<string, LocalEntry[]>();
    for (const e of entries) {
      const day = toDayString(new Date(e.recorded_at));
      byDay.set(day, [...(byDay.get(day) ?? []), e]);
    }
    const start = everyday ? null : trip.starts_on ? new Date(`${trip.starts_on}T00:00:00`) : entries[0] ? new Date(toDayString(new Date(entries[0].recorded_at)) + 'T00:00:00') : null;
    return [...byDay.entries()].map(([day, list]) => {
      const n = start ? Math.round((new Date(`${day}T00:00:00`).getTime() - start.getTime()) / 86400000) + 1 : null;
      const year = day.slice(0, 4) !== String(new Date().getFullYear());
      const label = n == null ? formatDay(day, { weekday: true, year }) : n > 0 ? `Day ${n}` : 'Before the trip';
      return { day, label, list };
    });
  }, [entries, trip.starts_on, everyday]);

  const moneyByMoment = useMemo(() => totalsByMoment(expenses), [expenses]);
  const symbol = currencySymbol(trip.currency || 'INR');

  return (
    <View>
      <MomentComposer
        placeholder={everyday ? 'How was today? Little things count…' : 'What happened? Sights, people, feelings…'}
        text={text}
        onText={setText}
        mood={mood}
        onMood={setMood}
        photos={photos}
        onPhotos={setPhotos}
        onAddPhotos={addPhotosToDraft}
        location={attachContext}
        onLocation={setAttachContext}
        money={money}
        onMoney={setMoney}
        currencySymbol={symbol}
        recording={!!recording}
        voiceBusy={voiceBusy}
        onToggleVoice={toggleVoice}
        saving={saving}
        canSave={Boolean(text.trim() || photos.length || money)}
        onSave={save}
      />

      {!groups.length ? (
        <EmptyState
          compact
          icon="feather"
          title={everyday ? 'Your first page' : 'Your first moment'}
          body={everyday
            ? 'One line a day is enough. Only you can see this journal, and it works offline.'
            : 'Write a line, add a photo or record a voice note. It all works offline.'}
        />
      ) : null}

      {groups.length > shownDays ? (
        <Button mode="outlined" onPress={() => setShownDays(n => n + DAYS_PER_PAGE)} style={{ alignSelf: 'center', marginBottom: 12 }}>
          Show earlier days ({groups.length - shownDays} more)
        </Button>
      ) : null}
      {groups.slice(-shownDays).map(g => (
        <View key={g.day}>
          {/* The same pill as the Journal / Plan / Budget tabs above. */}
          <View style={{ marginBottom: 10, marginTop: 4 }} accessibilityRole="header">
            <Pill label={g.label} icon="calendar-blank-outline" selected />
          </View>
          {g.list.map(e => (
            <MomentCard
              key={e.id}
              entry={e}
              money={moneyByMoment.get(e.id)}
              currencySymbol={symbol}
              mediaKey={mediaKey}
              canShare={social}
              tripId={trip.id}
              onChanged={onChanged}
              onAddPhotos={() => addPhotosToEntry(e.id)}
              onDelete={() => remove(e)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
