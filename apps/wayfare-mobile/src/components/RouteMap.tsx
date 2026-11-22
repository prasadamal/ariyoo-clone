import { useMemo } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Button, Text } from 'react-native-paper';
import { googleMapsApiKey } from '../config';
import { regionFor, type LatLng } from '../lib/geo';
import { mapsSupported } from '../lib/mapSupport';
import { mapsLink } from '../lib/sosMessage';
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

  // Without a Google Maps key an Android build would close the app when a map appears, so show the
  // route's position and a button that opens the phone's own Maps app instead.
  if (!mapsSupported(Platform.OS, googleMapsApiKey)) {
    const last = end ?? start ?? pins[pins.length - 1];
    return (
      <View style={[styles.empty, { backgroundColor: colors.surfaceVariant }]}>
        <Text style={{ color: colors.muted, textAlign: 'center', marginBottom: 8 }}>
          The map is not available in this version of the app. Your route is still being recorded.
        </Text>
        {last ? (
          <Button mode="outlined" icon="map-search-outline" onPress={() => Linking.openURL(mapsLink(last.latitude, last.longitude))}>
            Open latest point in Maps
          </Button>
        ) : null}
      </View>
    );
  }

  return (
    <MapView style={[styles.map, { height }]} initialRegion={region} scrollEnabled zoomEnabled showsCompass toolbarEnabled={false}>
      {points.length > 1 ? <Polyline coordinates={points} strokeColor={colors.primary} strokeWidth={4} /> : null}
      {start ? <Marker coordinate={start} title="Start" pinColor="#0f766e" /> : null}
      {points.length > 1 && end ? <Marker coordinate={end} title="Latest" pinColor="#6a01a3" /> : null}
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
