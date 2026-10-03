import { listTrackPointsForExport } from './localDb';

export async function buildTripGeoJson(tripId: string, title: string) {
  const points = await listTrackPointsForExport(tripId);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: title, pointCount: points.length },
        geometry: {
          type: 'LineString',
          coordinates: points.map(p => [p.longitude, p.latitude, p.altitude_m ?? 0]),
        },
      },
    ],
  };
}
