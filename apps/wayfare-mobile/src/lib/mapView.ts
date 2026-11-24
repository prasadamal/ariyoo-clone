/**
 * What a trip map shows and where it looks (pure, no map library): the route as a GeoJSON line,
 * pins as GeoJSON points, and a camera that fits them all.
 */

export type LatLng = { latitude: number; longitude: number };

export type MapPinKind = 'start' | 'end' | 'moment' | 'person';
export type MapPin = LatLng & { id: string; kind: MapPinKind };

/** [west, south, east, north], the order MapLibre expects. */
export type Bounds = [number, number, number, number];

export type MapCamera = { bounds: Bounds } | { center: [number, number]; zoom: number };

const valid = (p: LatLng) =>
  Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180 && !(p.latitude === 0 && p.longitude === 0);

/**
 * A camera that shows every point. One point (or points a few metres apart) gets a street-level
 * zoom instead of a box, which would zoom in as far as the map goes.
 */
export function cameraFor(points: LatLng[]): MapCamera | null {
  const pts = points.filter(valid);
  if (!pts.length) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of pts) {
    w = Math.min(w, p.longitude);
    e = Math.max(e, p.longitude);
    s = Math.min(s, p.latitude);
    n = Math.max(n, p.latitude);
  }
  if (e - w < 0.004 && n - s < 0.004) return { center: [(w + e) / 2, (s + n) / 2], zoom: 14 };
  return { bounds: [w, s, e, n] };
}

/** The route as one GeoJSON line (null with fewer than two good points). */
export function routeLine(points: LatLng[]): GeoJSON.Feature<GeoJSON.LineString> | null {
  const pts = points.filter(valid);
  if (pts.length < 2) return null;
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.map(p => [p.longitude, p.latitude]) } };
}

const PIN_STYLE: Record<MapPinKind, { r: number; order: number }> = {
  moment: { r: 5, order: 0 },
  start: { r: 7, order: 1 },
  end: { r: 8, order: 2 },
  person: { r: 9, order: 3 },
};

/** Pins as GeoJSON points, each with its kind and size; later kinds draw on top. */
export function pinPoints(pins: MapPin[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: pins
      .filter(valid)
      .sort((a, b) => PIN_STYLE[a.kind].order - PIN_STYLE[b.kind].order)
      .map(p => ({
        type: 'Feature',
        id: p.id,
        properties: { kind: p.kind, r: PIN_STYLE[p.kind].r },
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
      })),
  };
}

/** Start and latest pins for a recorded route. */
export function routeEnds(points: LatLng[]): MapPin[] {
  const pts = points.filter(valid);
  if (!pts.length) return [];
  const first = pts[0];
  const last = pts[pts.length - 1];
  return pts.length > 1
    ? [
        { ...first, id: 'start', kind: 'start' },
        { ...last, id: 'end', kind: 'end' },
      ]
    : [{ ...first, id: 'start', kind: 'start' }];
}
