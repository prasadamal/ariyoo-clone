import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import type { LatLng } from '../lib/geo';
import { useAppTheme } from '../theme';

type Props = { points: LatLng[]; height?: number; color?: string; strokeWidth?: number; background?: string };

/**
 * Lightweight route shape (no map tiles) for feed cards and share cards. Uses an
 * equirectangular projection corrected by latitude so shapes are not stretched.
 */
export function RouteSparkline({ points, height = 120, color, strokeWidth = 3, background }: Props) {
  const { colors } = useAppTheme();
  const stroke = color ?? colors.primary;
  const width = 300;
  const pad = 10;
  const shape = useMemo(() => {
    if (points.length < 2) return null;
    const midLat = (points.reduce((s, p) => s + p.latitude, 0) / points.length) * (Math.PI / 180);
    const xs = points.map(p => p.longitude * Math.cos(midLat));
    const ys = points.map(p => -p.latitude);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 1e-6;
    const spanY = maxY - minY || 1e-6;
    const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
    const offX = (width - spanX * scale) / 2;
    const offY = (height - spanY * scale) / 2;
    const pts = xs.map((x, i) => [offX + (x - minX) * scale, offY + (ys[i] - minY) * scale] as const);
    return { str: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '), start: pts[0], end: pts[pts.length - 1] };
  }, [points, height]);

  if (!shape) return null;
  return (
    <View style={{ height, borderRadius: 14, overflow: 'hidden', backgroundColor: background ?? colors.surfaceVariant }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <Polyline points={shape.str} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={shape.start[0]} cy={shape.start[1]} r={5} fill={colors.secondary} />
        <Circle cx={shape.end[0]} cy={shape.end[1]} r={5} fill={stroke} />
      </Svg>
    </View>
  );
}
