import { cleanTrack } from './geo';
import { listTrackPoints } from './localDb';

export async function buildTripGeoJson(tripId: string, title: string) {
  const points = cleanTrack(await listTrackPoints(tripId));
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: title, pointCount: points.length },
        geometry: { type: 'LineString', coordinates: points.map(p => [p.longitude, p.latitude, p.altitude_m ?? 0]) },
      },
    ],
  };
}

function xml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** GPX 1.1 track — opens in Strava, Gaia, Komoot, Google Earth… */
export async function buildTripGpx(tripId: string, title: string) {
  const points = cleanTrack(await listTrackPoints(tripId));
  const trkpts = points
    .map(
      p =>
        `      <trkpt lat="${p.latitude.toFixed(6)}" lon="${p.longitude.toFixed(6)}">` +
        (p.altitude_m != null ? `<ele>${p.altitude_m.toFixed(1)}</ele>` : '') +
        `<time>${new Date(p.recorded_at).toISOString()}</time></trkpt>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wayfare" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xml(title)}</name></metadata>
  <trk>
    <name>${xml(title)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}
