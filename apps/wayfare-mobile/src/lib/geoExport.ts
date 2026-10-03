import { listTrackPointsForExport } from './localDb';

export async function buildTripGeoJson(tripId: string, title: string) {
  const points = await listTrackPointsForExport(tripId);
  const coordinates = points.map(p => [p.longitude, p.latitude, p.altitude_m ?? 0]);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: title, pointCount: points.length },
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  };
}
