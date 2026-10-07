import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Text } from 'react-native-paper';
import { regionFor, type LatLng } from '../lib/geo';
import { useAppTheme } from '../theme';

type Pin = LatLng & { id: string; title: string; description?: string };

export function RouteMap({ points, pins = [], height = 240 }: { points: LatLng[]; pins?: Pin[]; height?: number }) {
  const { colors } = useAppTheme();
  const region = useMemo(() => regionFor([...points, ...pins]), [points, pins]);

  if (!region) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.surfaceVariant, height: 120 }]}>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>
          Record your route or geotag entries to see your journey on the map.
        </Text>
      </View>
    );
  }

  const start = points[0];
  const end = points[points.length - 1];

  return (
    <MapView style={[styles.map, { height }]} initialRegion={region} scrollEnabled zoomEnabled showsCompass toolbarEnabled={false}>
      {points.length > 1 ? <Polyline coordinates={points} strokeColor={colors.primary} strokeWidth={4} /> : null}
      {start ? <Marker coordinate={start} title="Start" pinColor="#0f766e" /> : null}
      {points.length > 1 && end ? <Marker coordinate={end} title="Latest" pinColor="#c2410c" /> : null}
      {pins.map(p => (
        <Marker key={p.id} coordinate={p} title={p.title} description={p.description} pinColor="#7c3aed" />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', borderRadius: 16, marginBottom: 12 },
  empty: { borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12, padding: 16 },
});
