import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { Text } from 'react-native-paper';

type Point = { latitude: number; longitude: number };

export function RouteMap({ points }: { points: Point[] }) {
  const region = useMemo(() => {
    if (!points.length) return null;
    const lats = points.map(p => p.latitude);
    const lngs = points.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const pad = 0.01;
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, maxLat - minLat + pad),
      longitudeDelta: Math.max(0.02, maxLng - minLng + pad),
    };
  }, [points]);

  if (!points.length || !region) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: '#78716c' }}>Record a route to see your path on the map.</Text>
      </View>
    );
  }

  const start = points[0];
  const end = points[points.length - 1];

  return (
    <MapView style={styles.map} initialRegion={region} scrollEnabled zoomEnabled>
      <Polyline coordinates={points} strokeColor="#c2410c" strokeWidth={4} />
      <Marker coordinate={start} title="Start" pinColor="#0f766e" />
      {points.length > 1 ? <Marker coordinate={end} title="Latest" pinColor="#c2410c" /> : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 220, borderRadius: 12, marginBottom: 12 },
  empty: {
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    padding: 16,
  },
});
