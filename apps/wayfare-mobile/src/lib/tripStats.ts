import { listEntries, listExpenses, listPacking, listTrackPointsForExport } from './localDb';

const R = 6371e3;

function haversineM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export async function computeTripStats(tripId: string) {
  const [entries, expenses, packing, points] = await Promise.all([
    listEntries(tripId),
    listExpenses(tripId),
    listPacking(tripId),
    listTrackPointsForExport(tripId),
  ]);
  let distanceM = 0;
  for (let i = 1; i < points.length; i++) {
    distanceM += haversineM(
      { latitude: points[i - 1].latitude, longitude: points[i - 1].longitude },
      { latitude: points[i].latitude, longitude: points[i].longitude }
    );
  }
  const packed = packing.filter(p => p.packed).length;
  const spend = expenses.reduce((s, e) => s + e.amount, 0);
  const moods = entries.map(e => e.mood).filter(Boolean) as string[];
  const topMood = moods.length
    ? moods.sort((a, b) => moods.filter(m => m === b).length - moods.filter(m => m === a).length)[0]
    : null;

  return {
    entryCount: entries.length,
    photoReadyEntries: entries.length,
    distanceKm: distanceM / 1000,
    gpsPoints: points.length,
    spendInr: spend,
    packingDone: packed,
    packingTotal: packing.length,
    topMood,
    lastEntryAt: entries.length ? entries[entries.length - 1].recorded_at : null,
  };
}

export function buildTripSynopsis(title: string, stats: Awaited<ReturnType<typeof computeTripStats>>) {
  const parts: string[] = [];
  if (stats.entryCount) parts.push(`${stats.entryCount} journal moment${stats.entryCount === 1 ? '' : 's'}`);
  if (stats.distanceKm >= 0.5) parts.push(`${stats.distanceKm.toFixed(1)} km tracked`);
  if (stats.spendInr > 0) parts.push(`₹${Math.round(stats.spendInr)} spent`);
  if (stats.packingTotal) {
    parts.push(`${stats.packingDone}/${stats.packingTotal} packed`);
  }
  if (!parts.length) return `Your ${title} journal is ready for the first entry.`;
  return parts.join(' · ');
}
