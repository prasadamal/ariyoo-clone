import { useAudioRecorder } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { uuid } from '../../lib/id';
import { useCanConnect, useSocial } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDay, toDayString } from '../../lib/format';
import { countEntries, deleteEntry, listEntries, listEntriesPage, listExpenses, upsertEntry, upsertEntryMedia, upsertExpense, type LocalEntry, type LocalExpense, type LocalTrip } from '../../lib/localDb';
import { currencySymbol } from '../../lib/currencyMath';
import { totalsByMoment } from '../../lib/momentMoney';
import { persistJournalPhoto } from '../../lib/media';
import { VOICE_NOTE_PRESET, cancelVoiceRecording, startVoiceRecording, stopVoiceRecordingToDraft, type VoiceDraft } from '../../lib/voiceNote';
import { fetchWeatherSummary } from '../../lib/weather';
import { useAppTheme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { MomentCard } from './MomentCard';
import { MomentComposer, type MomentMoney } from './MomentComposer';
import { pickPhotos, type PickedPhoto } from './photoPicker';
import { Pill } from '../../ui/Pill';
import { placeFromCoords, type FoundPlace } from '../../lib/reverseGeocode';
import { canEditTrip } from '../../lib/crew';
import { Notice } from '../../ui/Notice';

/** `everyday` is the private journal for ordinary days: no "Day n" counter, a daily prompt. */
const DAYS_PER_PAGE = 30;

/** crewNames: user id → "@username" for moments written by other people in a shared journey. */
type Props = {
  trip: LocalTrip;
  onChanged: () => void;
  everyday?: boolean;
  crewNames?: Record<string, string>;
  /** The page calls this when you scroll near the bottom: the journal then loads its next moments. */
  registerLoadMore?: (loadMore: () => void) => void;
};

/** A journey's moments load this many at a time as you scroll. */
const MOMENTS_PER_PAGE = 5;

async function currentFix() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 200 });
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return pos.coords;
}

export function JournalTab({ trip, onChanged, everyday = false, crewNames = {}, registerLoadMore }: Props) {
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
  const [recording, setRecording] = useState(false);
  // Voice notes recorded for the moment being written; saved with it, like photos.
  const [voices, setVoices] = useState<VoiceDraft[]>([]);
  const recorder = useAudioRecorder(VOICE_NOTE_PRESET);
  const [mediaKey, setMediaKey] = useState(0);
  // Years of daily pages would render all at once; show recent days and load older ones on request.
  const [shownDays, setShownDays] = useState(DAYS_PER_PAGE);

  // Journeys: the first moments, then more as you scroll. The everyday journal keeps its own day paging.
  const [limit, setLimit] = useState(MOMENTS_PER_PAGE);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    if (everyday) setEntries(await listEntries(trip.id));
    else {
      const [page, count] = await Promise.all([listEntriesPage(trip.id, limit), countEntries(trip.id)]);
      setEntries(page);
      setTotal(count);
      setLoadingMore(false);
    }
    setExpenses(await listExpenses(trip.id));
  }, [trip.id, everyday, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const hasMore = !everyday && entries.length < total;
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setLimit(n => n + MOMENTS_PER_PAGE);
  }, [hasMore, loadingMore]);
  useEffect(() => {
    registerLoadMore?.(loadMore);
  }, [registerLoadMore, loadMore]);

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
    let place: FoundPlace | null = null;
    if (attachContext) {
      try {
        coords = await currentFix();
        if (coords) {
          // Weather and the place (city, state, country) are looked up together.
          const [w, p] = await Promise.all([
            fetchWeatherSummary(coords.latitude, coords.longitude).catch(() => null),
            placeFromCoords(coords.latitude, coords.longitude),
          ]);
          weather = w;
          place = p;
        }
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
      place_name: place?.name ?? null,
      weather,
      region: place?.region ?? null,
      country_code: place?.countryCode ?? null,
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
    if (recording || (!text.trim() && !photos.length && !money && !voices.length)) return;
    setSaving(true);
    try {
      const entry = await createEntry(text.trim() || (photos.length ? '📷' : voices.length ? '🎙 Voice note' : '💰'));
      if (photos.length) await attachPhotos(entry.id, photos);
      for (const v of voices) {
        await upsertEntryMedia({
          id: v.id,
          trip_id: trip.id,
          entry_id: entry.id,
          local_uri: v.uri,
          storage_path: null,
          mime_type: 'audio/m4a',
          sync_status: 'pending',
          updated_at: new Date().toISOString(),
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setText('');
      setMood('');
      setPhotos([]);
      setVoices([]);
      setMoney(null);
      setAttachContext(false);
      // A new moment is the latest, so it sits at the end: show everything down to it.
      if (!everyday) setLimit(total + 1);
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

  /** Record, then stop: the voice note waits in the moment box (with your words) until you tap Save. */
  const toggleVoice = async () => {
    if (voiceLock.current) return;
    voiceLock.current = true;
    setVoiceBusy(true);
    try {
      if (!recording) {
        await startVoiceRecording(recorder);
        setRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      } else {
        const draft = await stopVoiceRecordingToDraft(recorder);
        setRecording(false);
        setVoices(prev => [...prev, draft]);
      }
    } catch (e) {
      await cancelVoiceRecording(recorder).catch(() => undefined);
      setRecording(false);
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
  const canEdit = canEditTrip(trip);
  const mentionable = useMemo(
    () => Object.values(crewNames).filter(n => n.startsWith('@')).map(n => n.slice(1)),
    [crewNames]
  );
  const symbol = currencySymbol(trip.currency || 'INR');

  return (
    <View>
      {canEdit ? (
      <MomentComposer
        mentionable={mentionable}
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
        recording={recording}
        voiceCount={voices.length}
        onRemoveVoice={i => setVoices(prev => prev.filter((_, j) => j !== i))}
        voiceBusy={voiceBusy}
        onToggleVoice={toggleVoice}
        saving={saving}
        canSave={!recording && Boolean(text.trim() || photos.length || money || voices.length)}
        onSave={save}
      />
      ) : (
        <Notice text="You're a member of this journey: you see every moment. An admin can make you an admin so you can add your own." />
      )}

      {!groups.length ? (
        <EmptyState
          compact
          icon="feather"
          title={everyday ? 'Your first page' : 'Your first moment'}
          body={everyday
            ? 'One line a day is enough. Only you can see this journal, and it works offline.'
            : canEdit
              ? 'Write a line, add a photo or record a voice note. It all works offline.'
              : 'Moments the crew adds will show up here.'}
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
          <View style={{ marginBottom: 10, marginTop: 4, alignSelf: 'center' }} accessibilityRole="header">
            <Pill label={g.label} icon="calendar-blank-outline" selected />
          </View>
          {g.list.map(e => (
            <MomentCard
              key={e.id}
              entry={e}
              money={moneyByMoment.get(e.id)}
              currencySymbol={symbol}
              mediaKey={mediaKey}
              canShare={social && !e.author_id}
              canEdit={canEdit}
              author={e.author_id ? crewNames[e.author_id] ?? 'Crew' : undefined}
              tripId={trip.id}
              onChanged={onChanged}
              onAddPhotos={() => addPhotosToEntry(e.id)}
              onDelete={() => remove(e)}
            />
          ))}
        </View>
      ))}
      {hasMore ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          {loadingMore ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading more moments" />
          ) : (
            <Button mode="text" onPress={loadMore}>
              Show more moments ({total - entries.length})
            </Button>
          )}
        </View>
      ) : null}
    </View>
  );
}
