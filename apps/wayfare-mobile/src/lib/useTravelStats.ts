import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
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
  const mediaRows = await db.getAllAsync<{ updated_at: string; mime_type: string | null }>(
    'SELECT updated_at, mime_type FROM entry_media'
  );
  const trackPointsByTrip: StatsInput['trackPointsByTrip'] = {};
  for (const p of points) (trackPointsByTrip[p.trip_id] ??= []).push(p);
  const media = mediaRows.map(m => ({ at: m.updated_at, audio: (m.mime_type ?? '').startsWith('audio') }));
  return {
    input: {
      trips,
      entries,
      expenses,
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
