/**
 * Turns a recorded route into an SVG path that fits a box, so the Route tab can draw the journey's
 * shape without a map service (no API key, works offline). Pure, so it's testable.
 */
export type LatLngLike = { latitude: number; longitude: number };

export function sketchPath(points: readonly LatLngLike[], width: number, height: number, pad = 16) {
  if (points.length < 2 || width <= pad * 2 || height <= pad * 2) return null;
  const midLat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
  // Equirectangular: shrink longitude by cos(latitude) so shapes aren't stretched sideways.
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = points.map(p => p.longitude * k);
  const ys = points.map(p => -p.latitude);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9, spanY = maxY - minY || 1e-9;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2, offY = (height - spanY * scale) / 2;
  const at = (i: number) => ({ x: offX + (xs[i] - minX) * scale, y: offY + (ys[i] - minY) * scale });
  const pts = points.map((_, i) => at(i));
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return { d, start: pts[0], end: pts[pts.length - 1] };
}
