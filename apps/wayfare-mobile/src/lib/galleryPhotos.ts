import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';
import { uuid } from './id';
import { upsertEntry, upsertEntryMedia, type LocalTrip } from './localDb';
import { persistJournalPhoto } from './media';
import { galleryWindow, newPhotos, photosByDay, type GalleryPhoto } from './tripGallery';

/**
 * "Add photos from these dates": looks in the phone's gallery for photos taken during a journey.
 * Asks for photo access only when you tap; photos stay on the phone unless you add them.
 */
export const galleryAvailable = Platform.OS === 'android' || Platform.OS === 'ios';

const addedKey = (tripId: string) => `wayfare_gallery_added_${tripId}`;
const snoozeKey = (tripId: string) => `wayfare_gallery_snooze_${tripId}`;

export async function galleryAccess(): Promise<'granted' | 'ask' | 'denied'> {
  if (!galleryAvailable) return 'denied';
  const p = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  return p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'denied';
}

export async function askGalleryAccess() {
  const p = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  return p.granted;
}

async function readSet(key: string) {
  try {
    return new Set<string>(JSON.parse((await AsyncStorage.getItem(key)) ?? '[]'));
  } catch {
    return new Set<string>();
  }
}

/** Gallery photos taken on the journey's days that haven't been added (or snoozed) yet. */
export async function findTripPhotos(trip: Pick<LocalTrip, 'id' | 'starts_on' | 'ends_on'>): Promise<GalleryPhoto[]> {
  if (!galleryAvailable || !trip.starts_on) return [];
  const window = galleryWindow(trip.starts_on, trip.ends_on);
  if (!window) return [];
  const page = await MediaLibrary.getAssetsAsync({
    mediaType: MediaLibrary.MediaType.photo,
    createdAfter: window.after,
    createdBefore: window.before,
    sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    first: 300,
  });
  const photos: GalleryPhoto[] = page.assets.map(a => ({ id: a.id, uri: a.uri, creationTime: a.creationTime, width: a.width, height: a.height }));
  const snoozed = Number((await AsyncStorage.getItem(snoozeKey(trip.id)).catch(() => null)) ?? 0) || 0;
  return newPhotos(photos, await readSet(addedKey(trip.id)), snoozed);
}

/** "Not now": hide these; photos taken later bring the card back. */
export async function snoozeTripPhotos(tripId: string, photos: GalleryPhoto[]) {
  const latest = Math.max(0, ...photos.map(p => p.creationTime));
  await AsyncStorage.setItem(snoozeKey(tripId), String(latest));
}

/**
 * Adds the chosen photos to the journey: one moment per day (at the time of that day's first photo),
 * each photo resized and copied into the journal like a photo from the camera. Returns the day labels.
 */
export async function addTripPhotos(trip: Pick<LocalTrip, 'id' | 'starts_on' | 'ends_on'>, chosen: GalleryPhoto[]): Promise<string[]> {
  if (!trip.starts_on || !chosen.length) return [];
  const groups = photosByDay(chosen, trip.starts_on, trip.ends_on);
  const added = await readSet(addedKey(trip.id));
  for (const g of groups) {
    const now = new Date().toISOString();
    const entryId = uuid();
    await upsertEntry({
      id: entryId,
      trip_id: trip.id,
      recorded_at: new Date(g.photos[0].creationTime).toISOString(),
      body: '📷',
      mood: null,
      place_name: null,
      weather: null,
      latitude: null,
      longitude: null,
      altitude_m: null,
      sync_status: 'pending',
      updated_at: now,
    });
    for (const p of g.photos) {
      // iOS gallery URIs (ph://) need the file behind them; Android gives a file path directly.
      let uri = p.uri;
      if (Platform.OS === 'ios') uri = (await MediaLibrary.getAssetInfoAsync(p.id)).localUri ?? p.uri;
      const mediaId = uuid();
      const stored = await persistJournalPhoto(uri, mediaId, { width: p.width, height: p.height });
      await upsertEntryMedia({ id: mediaId, trip_id: trip.id, entry_id: entryId, local_uri: stored.uri, storage_path: null, mime_type: stored.mimeType, sync_status: 'pending', updated_at: new Date().toISOString() });
      added.add(p.id);
    }
    await AsyncStorage.setItem(addedKey(trip.id), JSON.stringify([...added]));
  }
  return groups.map(g => g.label);
}
