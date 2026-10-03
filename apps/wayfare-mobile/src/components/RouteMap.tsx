import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Text, useTheme } from 'react-native-paper';

type Point = { latitude: number; longitude: number };

export function RouteMap({ points }: { points: Point[] }) {
  const theme = useTheme();
  const region = useMemo(() => {
    if (!points.length) return null;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const p of points) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.3),
      longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.3),
    };
  }, [points]);

  if (!points.length || !region) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Record a route to see your path on the map.</Text>
      </View>
    );
  }

  const start = points[0];
  const end = points[points.length - 1];

  return (
    <MapView key={`${points.length > 1 ? 'p' : 'o'}`} style={styles.map} initialRegion={region} scrollEnabled zoomEnabled accessibilityLabel="Map of your recorded route">
      <Polyline coordinates={points} strokeColor="#c2410c" strokeWidth={4} />
      <Marker coordinate={start} title="Start" pinColor="#0f766e" />
      {points.length > 1 ? <Marker coordinate={end} title="Latest" pinColor="#c2410c" /> : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 240, borderRadius: 12, marginBottom: 12 },
  empty: { minHeight: 120, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12, padding: 16 },
});
