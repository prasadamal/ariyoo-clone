import { pathLengthM } from './geo';
import { listEntries, listExpenses, listPacking, listTrackPointsForExport } from './localDb';

export type TripStats = {
  entryCount: number;
  distanceKm: number;
  gpsPoints: number;
  spendInr: number;
  packingDone: number;
  packingTotal: number;
  topMood: string | null;
  lastEntryAt: string | null;
};

export function summarize(input: {
  entries: { mood: string | null; recorded_at: string }[];
  expenses: { amount: number }[];
  packing: { packed: number }[];
  points: { latitude: number; longitude: number }[];
}): TripStats {
  const counts = new Map<string, number>();
  for (const e of input.entries) if (e.mood) counts.set(e.mood, (counts.get(e.mood) ?? 0) + 1);
  const topMood = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    entryCount: input.entries.length,
    distanceKm: pathLengthM(input.points) / 1000,
    gpsPoints: input.points.length,
    spendInr: input.expenses.reduce((s, e) => s + e.amount, 0),
    packingDone: input.packing.filter(p => p.packed).length,
    packingTotal: input.packing.length,
    topMood,
    lastEntryAt: input.entries.length ? input.entries[input.entries.length - 1].recorded_at : null,
  };
}

export async function computeTripStats(tripId: string): Promise<TripStats> {
  const [entries, expenses, packing, points] = await Promise.all([
    listEntries(tripId),
    listExpenses(tripId),
    listPacking(tripId),
    listTrackPointsForExport(tripId),
  ]);
  return summarize({ entries, expenses, packing, points });
}

export function buildTripSynopsis(title: string, stats: TripStats) {
  const parts: string[] = [];
  if (stats.entryCount) parts.push(`${stats.entryCount} journal moment${stats.entryCount === 1 ? '' : 's'}`);
  if (stats.distanceKm >= 0.5) parts.push(`${stats.distanceKm.toFixed(1)} km tracked`);
  if (stats.spendInr > 0) parts.push(`₹${Math.round(stats.spendInr).toLocaleString('en-IN')} spent`);
  if (stats.packingTotal) parts.push(`${stats.packingDone}/${stats.packingTotal} packed`);
  return parts.length ? parts.join(' · ') : `Your ${title} journal is ready for the first entry.`;
}
