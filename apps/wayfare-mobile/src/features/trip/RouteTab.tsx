import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import Svg, { Circle, Path } from 'react-native-svg';
import { useToast } from '../../context/ToastContext';
import { formatAltitude, formatKm } from '../../lib/format';
import { cleanTrack, elevationProfile, elevationStats, trackDistanceKm } from '../../lib/geo';
import { buildTripGpx } from '../../lib/geoExport';
import { listEntries, listTrackPoints, type LocalTrackPoint, type LocalTrip } from '../../lib/localDb';
import { getActiveTrackingTripId, getTrackingMode, setTrackingMode, startTripTracking, stopTripTracking, type TrackingMode } from '../../lib/locationTask';
import { routeEnds, type MapPin } from '../../lib/mapView';
import { sketchPath } from '../../lib/routeSketch';
import { useAppTheme } from '../../theme';
import { ElevationChart } from '../../ui/ElevationChart';
import { FloatingTabs } from '../../ui/FloatingTabs';
import { Icon } from '../../ui/Icon';
import { mapAvailable, TripMap } from '../../ui/TripMap';

type Props = { trip: LocalTrip; onChanged: () => void };

const SKETCH_H = 200;
const MAP_H = 260;

/** One number in the stats row, in the same light tiles as the rest of the app. */
function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceVariant }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text style={{ fontWeight: '900', fontSize: 18, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

/**
 * The journey's route: its shape drawn from the recorded GPS points (no map service needed), the
 * distance / climb / high point, and one button to start or stop recording. Export is one icon.
 */
export function RouteTab({ trip, onChanged }: Props) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [points, setPoints] = useState<LocalTrackPoint[]>([]);
  const [tracking, setTracking] = useState(false);
  const [mode, setMode] = useState<TrackingMode>('battery');
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(0);
  // Moments saved with a location, shown as small dots on the map.
  const [momentPins, setMomentPins] = useState<MapPin[]>([]);
  const [mapFailed, setMapFailed] = useState(false);

  const load = useCallback(async () => {
    const [pts, active, m, entries] = await Promise.all([listTrackPoints(trip.id), getActiveTrackingTripId(), getTrackingMode(), listEntries(trip.id).catch(() => [])]);
    setPoints(pts);
    setTracking(active === trip.id);
    setMode(m);
    setMomentPins(
      entries
        .filter(e => e.latitude != null && e.longitude != null)
        .map(e => ({ id: e.id, latitude: e.latitude as number, longitude: e.longitude as number, kind: 'moment' as const }))
    );
  }, [trip.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  const clean = useMemo(() => cleanTrack(points), [points]);
  const km = useMemo(() => trackDistanceKm(points), [points]);
  const elev = useMemo(() => elevationStats(points), [points]);
  const profile = useMemo(() => elevationProfile(points), [points]);
  const sketch = useMemo(() => (width ? sketchPath(clean, width, SKETCH_H, 22) : null), [clean, width]);
  // A real map on phones (MapLibre, free OpenStreetMap tiles); the drawn shape in the browser
  // preview, or if the map can't load (offline before it was ever opened).
  const pins = useMemo(() => [...momentPins, ...routeEnds(clean)], [momentPins, clean]);
  const showMap = mapAvailable && !mapFailed && pins.length > 0;

  const toggle = async () => {
    setBusy(true);
    try {
      if (tracking) {
        await stopTripTracking();
        toast('Route recording stopped');
      } else {
        await startTripTracking(trip.id, mode);
        toast('Recording your route');
      }
      await load();
      onChanged();
    } catch (e) {
      Alert.alert('Location', e instanceof Error ? e.message : 'Could not start recording');
    } finally {
      setBusy(false);
    }
  };

  const changeMode = async (next: TrackingMode) => {
    setMode(next);
    await setTrackingMode(next);
    if (tracking) await startTripTracking(trip.id, next);
  };

  const exportGpx = async () => {
    try {
      const body = await buildTripGpx(trip.id, trip.title);
      const safe = trip.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'route';
      const uri = `${FileSystem.cacheDirectory}${safe}.gpx`;
      await FileSystem.writeAsStringAsync(uri, body);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/gpx+xml', dialogTitle: `${trip.title} route` });
      else await Share.share({ message: body.slice(0, 50_000), title: `${trip.title} route` });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not export the route');
    }
  };

  return (
    <View>
      {/* The route's shape on a soft brand background, start in green and the latest point in orange. */}
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: showMap ? MAP_H : SKETCH_H, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.surfaceVariant }}>
        {showMap ? (
          <TripMap route={clean} pins={pins} style={StyleSheet.absoluteFill} onFail={() => setMapFailed(true)} />
        ) : (
        <>
        <LinearGradient colors={[colors.primaryContainer, colors.surfaceVariant]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {sketch ? (
          // Its own layer, so the background gradient never paints over the line.
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={width} height={SKETCH_H} accessibilityLabel={`Route of ${formatKm(km)}`}>
            <Path d={sketch.d} stroke={colors.primary} strokeOpacity={0.25} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={sketch.d} stroke={colors.primary} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={sketch.start.x} cy={sketch.start.y} r={7} fill="#16a34a" stroke="#fff" strokeWidth={2.5} />
            <Circle cx={sketch.end.x} cy={sketch.end.y} r={8} fill={colors.secondary} stroke="#fff" strokeWidth={2.5} />
          </Svg>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Icon name="map-marker-path" size={36} color={colors.primary} />
            <Text style={{ fontWeight: '800', marginTop: 8 }}>No route yet</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 2 }}>Start recording when you set off. Your path is drawn here.</Text>
          </View>
        )}
        </>
        )}
        {showMap && clean.length < 2 ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surface }}>
            <Text style={{ fontSize: 12, fontWeight: '600' }}>No route yet · dots are your moments</Text>
          </View>
        ) : null}
        {clean.length >= 2 ? (
          <IconButton icon="export-variant" mode="contained-tonal" size={18} onPress={exportGpx} accessibilityLabel="Export route (GPX)" style={{ position: 'absolute', top: 6, right: 6 }} />
        ) : null}
        {tracking ? (
          <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.danger }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' }} />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Recording</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Stat icon="map-marker-distance" value={formatKm(km)} label="Distance" />
        <Stat icon="stairs-up" value={`${elev.gainM.toLocaleString('en-IN')} m`} label="Climbed" />
        <Stat icon="image-filter-hdr" value={formatAltitude(elev.maxM)} label="High point" />
      </View>

      {profile.length > 2 ? (
        <View style={{ marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceVariant }}>
          <Text style={{ fontWeight: '800', marginBottom: 6 }}>Elevation</Text>
          <ElevationChart series={profile} />
        </View>
      ) : null}

      <FloatingTabs<TrackingMode>
        accessibilityLabel="Recording accuracy"
        tabs={[
          { value: 'battery', label: 'Battery saver' },
          { value: 'precise', label: 'Precise' },
        ]}
        value={mode}
        onChange={changeMode}
        style={{ alignSelf: 'center', marginTop: 16 }}
      />
      <Button
        mode="contained"
        icon={tracking ? 'stop-circle-outline' : 'record-circle-outline'}
        onPress={toggle}
        loading={busy}
        disabled={busy}
        buttonColor={tracking ? colors.danger : undefined}
        style={{ marginTop: 12 }}
        contentStyle={{ height: 48 }}
      >
        {tracking ? 'Stop recording' : 'Start recording'}
      </Button>
    </View>
  );
}
