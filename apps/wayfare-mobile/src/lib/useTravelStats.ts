import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { journeysOnly } from './everydayMemories';
import { getDb, listAllEntries, listAllExpenses, listAllTrackPoints, listTrips } from './localDb';
import type { StatsInput } from './travelStats';
import { computeTravelStats, type TravelStats } from './travelStats';
import type { DatedMedia } from './wrapped';

/** Loads everything the stats/badges/wrapped screens need from the on-device journal. */
export async function loadStatsInput(): Promise<{ input: StatsInput; media: DatedMedia[] }> {
  const [trips, entries, expenses, points, db] = await Promise.all([
    listTrips(),
    listAllEntries(),
    listAllExpenses(),
    listAllTrackPoints(),
    getDb(),
  ]);
  // Your own travels: moments, photos and spending you added, and journeys you started or help run
  // (a journey you only follow as a member isn't one you took).
  const mediaRows = await db.getAllAsync<{ updated_at: string; mime_type: string | null }>(
    'SELECT updated_at, mime_type FROM entry_media WHERE author_id IS NULL'
  );
  const mineEntries = entries.filter(e => !e.author_id);
  const mineExpenses = expenses.filter(e => !e.author_id);
  const myTrips = trips.filter(t => t.my_role !== 'member');
  const trackPointsByTrip: StatsInput['trackPointsByTrip'] = {};
  for (const p of points) (trackPointsByTrip[p.trip_id] ??= []).push(p);
  const media = mediaRows.map(m => ({ at: m.updated_at, audio: (m.mime_type ?? '').startsWith('audio') }));
  return {
    input: {
      // Everyday pages count as entries, streaks and photos, but the everyday journal is not a trip.
      trips: journeysOnly(myTrips),
      entries: mineEntries,
      expenses: mineExpenses,
      trackPointsByTrip,
      photos: media.filter(m => !m.audio).length,
      voiceNotes: media.filter(m => m.audio).length,
    },
    media,
  };
}

export function useTravelStats() {
  const [stats, setStats] = useState<TravelStats | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadStatsInput()
        .then(({ input }) => alive && setStats(computeTravelStats(input)))
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [])
  );
  return stats;
}
