import { getDb, type LocalEntryMedia, type LocalTrip } from './localDb';
import { resolveMediaUri } from './media';

/**
 * The picture for a journey's cover: the cover photo you chose, or else the newest photo added to one
 * of its moments. Null when the journey has no photos yet (the brand colour is used instead).
 */
export async function tripCoverUri(trip: Pick<LocalTrip, 'id' | 'cover_uri'>): Promise<string | null> {
  if (trip.cover_uri) return trip.cover_uri;
  const db = await getDb();
  const photos = await db.getAllAsync<LocalEntryMedia>(
    "SELECT * FROM entry_media WHERE trip_id = ? AND (mime_type IS NULL OR mime_type NOT LIKE 'audio%') ORDER BY updated_at DESC LIMIT 3",
    [trip.id]
  );
  for (const photo of photos) {
    const uri = await resolveMediaUri(photo).catch(() => null);
    if (uri) return uri;
  }
  return null;
}
