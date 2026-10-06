/** Pure geo helpers (no React Native imports) — shared by stats, maps and tests. */

export type LatLng = { latitude: number; longitude: number };

export type TrackPoint = LatLng & {
  recorded_at: string;
  altitude_m?: number | null;
  accuracy_m?: number | null;
};

const EARTH_RADIUS_M = 6371e3;
/** Same thresholds as the server's verified-route calculation (trip_route_km). */
export const MAX_ACCURACY_M = 75;
export const MAX_SPEED_KMH = 200;

export function haversineM(a: LatLng, b: LatLng) {
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)));
}

function seconds(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 1000;
}

function speedKmh(a: TrackPoint, b: TrackPoint) {
  return (haversineM(a, b) / Math.max(Math.abs(seconds(a.recorded_at, b.recorded_at)), 1)) * 3.6;
}

/**
 * Drops inaccurate fixes and single-point GPS spikes (a fix that is impossibly fast to
 * reach from *both* neighbours). Input order does not matter; output is chronological.
 */
export function cleanTrack<T extends TrackPoint>(points: T[]): T[] {
  const sorted = points
    .filter(p => (p.accuracy_m ?? 0) <= MAX_ACCURACY_M)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  return sorted.filter((p, i) => {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    if (!prev || !next) return true;
    return !(speedKmh(prev, p) > MAX_SPEED_KMH && speedKmh(p, next) > MAX_SPEED_KMH);
  });
}

/** Distance along a cleaned track, ignoring flights / gaps faster than MAX_SPEED_KMH. */
export function trackDistanceKm(points: TrackPoint[]) {
  const clean = cleanTrack(points);
  let meters = 0;
  for (let i = 1; i < clean.length; i++) {
    const dt = seconds(clean[i - 1].recorded_at, clean[i].recorded_at);
    if (dt <= 0) continue;
    const d = haversineM(clean[i - 1], clean[i]);
    if ((d / dt) * 3.6 <= MAX_SPEED_KMH) meters += d;
  }
  return meters / 1000;
}

export type ElevationStats = {
  gainM: number;
  lossM: number;
  minM: number | null;
  maxM: number | null;
};

/** Elevation gain/loss with a hysteresis band so GPS altitude noise is not counted. */
export function elevationStats(points: TrackPoint[], noiseBandM = 8): ElevationStats {
  const alts = cleanTrack(points)
    .map(p => p.altitude_m)
    .filter((a): a is number => typeof a === 'number' && a > -500 && a < 9000);
  if (!alts.length) return { gainM: 0, lossM: 0, minM: null, maxM: null };
  let gain = 0;
  let loss = 0;
  let anchor = alts[0];
  for (const a of alts) {
    const diff = a - anchor;
    if (diff >= noiseBandM) {
      gain += diff;
      anchor = a;
    } else if (diff <= -noiseBandM) {
      loss -= diff;
      anchor = a;
    }
  }
  return { gainM: Math.round(gain), lossM: Math.round(loss), minM: Math.min(...alts), maxM: Math.max(...alts) };
}

/** Cumulative-distance vs altitude series for an elevation chart. */
export function elevationProfile(points: TrackPoint[], maxSamples = 120) {
  const clean = cleanTrack(points).filter(p => typeof p.altitude_m === 'number');
  const series: { km: number; alt: number }[] = [];
  let meters = 0;
  for (let i = 0; i < clean.length; i++) {
    if (i > 0) meters += haversineM(clean[i - 1], clean[i]);
    series.push({ km: meters / 1000, alt: clean[i].altitude_m as number });
  }
  return downsample(series, maxSamples);
}

export function downsample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = Math.ceil(items.length / max);
  const out = items.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== items[items.length - 1]) out.push(items[items.length - 1]);
  return out;
}

export function boundsOf(points: LatLng[]) {
  if (!points.length) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  return { minLat, maxLat, minLng, maxLng };
}

export function regionFor(points: LatLng[], minDelta = 0.02, pad = 1.3) {
  const b = boundsOf(points);
  if (!b) return null;
  return {
    latitude: (b.minLat + b.maxLat) / 2,
    longitude: (b.minLng + b.maxLng) / 2,
    latitudeDelta: Math.max(minDelta, (b.maxLat - b.minLat) * pad),
    longitudeDelta: Math.max(minDelta, (b.maxLng - b.minLng) * pad),
  };
}

/** Rounds a coordinate to a privacy-friendly grid (2 decimals ≈ 1.1 km). */
export function coarsen(value: number, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function formatCoords(p: LatLng, decimals = 5) {
  return `${p.latitude.toFixed(decimals)}, ${p.longitude.toFixed(decimals)}`;
}

/** [lng, lat] pairs (GeoJSON order, as returned by the server route preview) → LatLng. */
export function fromLngLatPairs(pairs: unknown): LatLng[] {
  if (!Array.isArray(pairs)) return [];
  return pairs
    .filter((p): p is [number, number] => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number')
    .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}
