import { EVERYDAY_TRIP_TYPE } from './everydayMemories';
import { uuid } from './id';
import { withJournalLock } from './journalGate';
import { getDb, upsertTrip, type LocalTrip } from './localDb';

export { EVERYDAY_TRIP_TYPE, isEverydayTrip, journeysOnly } from './everydayMemories';

let creating: Promise<LocalTrip> | null = null;

/**
 * The private journal for ordinary days, created the first time it is opened.
 *
 * Stored as a trip so it syncs, backs up and supports photos and voice notes exactly like a journey,
 * but every journey list, stat and matching query leaves it out. If two phones each created one
 * before syncing, the one with the lowest id wins on every phone and the other's entries move into it.
 */
export function ensureEverydayTrip(): Promise<LocalTrip> {
  // A double tap or two screens opening at once must not create two journals.
  creating ??= withJournalLock(async () => {
    const database = await getDb();
    const existing = await database.getAllAsync<LocalTrip>('SELECT * FROM trips WHERE trip_type = ? ORDER BY id ASC', [EVERYDAY_TRIP_TYPE]);
    if (existing.length) {
      const [keep, ...extra] = existing;
      for (const dup of extra) {
        await database.runAsync(
          "UPDATE entries SET trip_id = ?, sync_status = 'pending', updated_at = ? WHERE trip_id = ?",
          [keep.id, new Date().toISOString(), dup.id]
        );
      }
      return keep;
    }
    const trip: LocalTrip = {
      id: uuid(),
      title: 'Everyday journal',
      trip_type: EVERYDAY_TRIP_TYPE,
      destination: null,
      starts_on: null,
      ends_on: null,
      visibility: 'private',
      companions: null,
      status: 'active',
      notes: null,
      share_id: null,
      place_key: null,
      open_to_meet: 0,
      currency: 'INR',
      budget_total: null,
      dest_lat: null,
      dest_lng: null,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    };
    await upsertTrip(trip);
    return trip;
  }).finally(() => {
    creating = null;
  });
  return creating;
}

/** The everyday journal if it exists yet, without creating it (for read-only home cards). */
export async function findEverydayTrip(): Promise<LocalTrip | null> {
  const database = await getDb();
  return database.getFirstAsync<LocalTrip>('SELECT * FROM trips WHERE trip_type = ? ORDER BY id ASC', [EVERYDAY_TRIP_TYPE]);
}
