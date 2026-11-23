import { formatMoney } from './currencyMath';
import { formatKm } from './format';
import { elevationStats, trackDistanceKm } from './geo';
import { listEntries, listExpenses, listItinerary, listPacking, listTrackPoints, listTripMedia } from './localDb';
import { isAudio } from './media';
import { defaultListFor, packCounts } from './packingLists';
import { loadPackingLists, loadTripList } from './packingListsStore';

export type TripStats = {
  entryCount: number;
  photoCount: number;
  voiceCount: number;
  distanceKm: number;
  gainM: number;
  maxAltitudeM: number | null;
  gpsPoints: number;
  spendByCurrency: Record<string, number>;
  packingDone: number;
  packingTotal: number;
  planDone: number;
  planTotal: number;
  topMood: string | null;
  lastEntryAt: string | null;
};

/** dates: the journey's start/end, used to pick its default packing list when none was chosen yet. */
export async function computeTripStats(tripId: string, dates?: { starts_on: string | null; ends_on: string | null }): Promise<TripStats> {
  const [entries, expenses, packing, points, plan, media, lists, chosen] = await Promise.all([
    listEntries(tripId),
    listExpenses(tripId),
    listPacking(tripId),
    listTrackPoints(tripId),
    listItinerary(tripId),
    listTripMedia(tripId),
    loadPackingLists(),
    loadTripList(tripId),
  ]);
  // Packing is counted against the personal list the journey uses (a journey only stores what's ticked).
  const pack = packCounts(lists, chosen ?? defaultListFor(dates?.starts_on ?? null, dates?.ends_on ?? null), packing);
  const elev = elevationStats(points);
  const spendByCurrency: Record<string, number> = {};
  for (const e of expenses) spendByCurrency[e.currency] = (spendByCurrency[e.currency] ?? 0) + e.amount;
  const moodCounts = new Map<string, number>();
  for (const e of entries) if (e.mood) moodCounts.set(e.mood, (moodCounts.get(e.mood) ?? 0) + 1);
  const topMood = [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    entryCount: entries.length,
    photoCount: media.filter(m => !isAudio(m.mime_type)).length,
    voiceCount: media.filter(m => isAudio(m.mime_type)).length,
    distanceKm: trackDistanceKm(points),
    gainM: elev.gainM,
    maxAltitudeM: elev.maxM,
    gpsPoints: points.length,
    spendByCurrency,
    packingDone: pack.done,
    packingTotal: pack.total,
    planDone: plan.filter(p => p.done).length,
    planTotal: plan.length,
    topMood,
    lastEntryAt: entries.length ? entries[entries.length - 1].recorded_at : null,
  };
}

export function formatSpend(spendByCurrency: Record<string, number>) {
  const parts = Object.entries(spendByCurrency)
    .filter(([, v]) => v > 0)
    .map(([c, v]) => formatMoney(v, c, { compact: true }));
  return parts.join(' + ');
}

export function buildTripSynopsis(title: string, stats: TripStats) {
  const parts: string[] = [];
  if (stats.entryCount) parts.push(`${stats.entryCount} moment${stats.entryCount === 1 ? '' : 's'}`);
  if (stats.photoCount) parts.push(`${stats.photoCount} photo${stats.photoCount === 1 ? '' : 's'}`);
  if (stats.distanceKm >= 0.5) parts.push(`${formatKm(stats.distanceKm)} tracked`);
  const spend = formatSpend(stats.spendByCurrency);
  if (spend) parts.push(`${spend} spent`);
  if (stats.packingTotal) parts.push(`${stats.packingDone}/${stats.packingTotal} packed`);
  if (!parts.length) return `Your ${title} journal is ready for its first moment.`;
  return parts.join(' · ');
}
