import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Text } from 'react-native-paper';
import { formatAltitude } from '../lib/format';
import { useAppTheme } from '../theme';

/** Area chart of altitude against distance travelled. */
export function ElevationChart({ series, height = 110 }: { series: { km: number; alt: number }[]; height?: number }) {
  const { colors } = useAppTheme();
  const width = 300;
  const data = useMemo(() => {
    if (series.length < 2) return null;
    const maxKm = series[series.length - 1].km || 1;
    const alts = series.map(s => s.alt);
    const min = Math.min(...alts);
    const max = Math.max(...alts);
    const span = max - min || 1;
    const x = (km: number) => (km / maxKm) * width;
    const y = (alt: number) => height - 6 - ((alt - min) / span) * (height - 18);
    const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(s.km).toFixed(1)},${y(s.alt).toFixed(1)}`).join(' ');
    return { line, area: `${line} L${width},${height} L0,${height} Z`, min, max, maxKm };
  }, [series, height]);
  if (!data) return null;
  return (
    <View>
      <View style={{ height, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceVariant }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="elev" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.secondary} stopOpacity={0.45} />
              <Stop offset="1" stopColor={colors.secondary} stopOpacity={0.05} />
            </LinearGradient>
          </Defs>
          <Path d={data.area} fill="url(#elev)" />
          <Path d={data.line} fill="none" stroke={colors.secondary} strokeWidth={2.5} />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: colors.muted }}>Low {formatAltitude(data.min)}</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>{data.maxKm.toFixed(1)} km</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>High {formatAltitude(data.max)}</Text>
      </View>
    </View>
  );
}
