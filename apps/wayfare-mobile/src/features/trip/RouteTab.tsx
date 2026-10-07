import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { Button, SegmentedButtons, Text } from 'react-native-paper';
import { RouteMap } from '../../components/RouteMap';
import { useCanConnect } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatAltitude, formatKm } from '../../lib/format';
import { cleanTrack, elevationProfile, elevationStats, trackDistanceKm } from '../../lib/geo';
import { buildTripGeoJson, buildTripGpx } from '../../lib/geoExport';
import { listEntries, listTrackPoints, type LocalEntry, type LocalTrackPoint, type LocalTrip } from '../../lib/localDb';
import {
  getActiveTrackingTripId,
  getTrackingMode,
  setTrackingMode,
  startTripTracking,
  stopTripTracking,
  type TrackingMode,
} from '../../lib/locationTask';
import { useAppTheme } from '../../theme';
import { ElevationChart } from '../../ui/ElevationChart';
import { StatRow, StatTile } from '../../ui/StatTile';

type Props = { trip: LocalTrip; onChanged: () => void };

export function RouteTab({ trip, onChanged }: Props) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const canConnect = useCanConnect();
  const [points, setPoints] = useState<LocalTrackPoint[]>([]);
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [tracking, setTracking] = useState(false);
  const [mode, setMode] = useState<TrackingMode>('battery');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [pts, ents, active, m] = await Promise.all([listTrackPoints(trip.id), listEntries(trip.id), getActiveTrackingTripId(), getTrackingMode()]);
    setPoints(pts);
    setEntries(ents);
    setTracking(active === trip.id);
    setMode(m);
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
  const pins = useMemo(
    () =>
      entries
        .filter(e => e.latitude != null && e.longitude != null)
        .map(e => ({
          id: e.id,
          latitude: e.latitude as number,
          longitude: e.longitude as number,
          title: e.place_name || new Date(e.recorded_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
          description: (e.body ?? '').slice(0, 80),
        })),
    [entries]
  );

  const toggle = async () => {
    setBusy(true);
    try {
      if (tracking) {
        await stopTripTracking();
        toast('Route recording stopped');
      } else {
        await startTripTracking(trip.id, mode);
        toast(mode === 'precise' ? 'Recording every ~15 s / 10 m' : 'Recording every ~1 min / 25 m (battery saver)');
      }
      await load();
      onChanged();
    } catch (e) {
      Alert.alert('Location', e instanceof Error ? e.message : 'Could not start recording');
    } finally {
      setBusy(false);
    }
  };

  const changeMode = async (m: string) => {
    const next = m as TrackingMode;
    setMode(next);
    await setTrackingMode(next);
    if (tracking) await startTripTracking(trip.id, next);
  };

  const exportFile = async (kind: 'gpx' | 'geojson') => {
    try {
      const body = kind === 'gpx' ? await buildTripGpx(trip.id, trip.title) : JSON.stringify(await buildTripGeoJson(trip.id, trip.title), null, 2);
      const safe = trip.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'route';
      const uri = `${FileSystem.cacheDirectory}${safe}.${kind}`;
      await FileSystem.writeAsStringAsync(uri, body);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: kind === 'gpx' ? 'application/gpx+xml' : 'application/geo+json',
          dialogTitle: `${trip.title} route`,
        });
      } else {
        await Share.share({ message: body.slice(0, 50_000), title: `${trip.title} route` });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed');
    }
  };

  return (
    <View>
      <RouteMap points={clean} pins={pins} />
      <StatRow>
        <StatTile icon="map-marker-path" value={formatKm(km)} label="Distance" />
        <StatTile icon="stairs-up" value={`${elev.gainM.toLocaleString('en-IN')} m`} label="Climbed" tint={colors.secondary} />
        <StatTile icon="image-filter-hdr" value={formatAltitude(elev.maxM)} label="High point" tint={colors.tertiary} />
      </StatRow>
      {profile.length > 2 ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Elevation profile</Text>
          <ElevationChart series={profile} />
        </View>
      ) : null}

      <View style={{ marginTop: 16, gap: 10 }}>
        <SegmentedButtons
          value={mode}
          onValueChange={changeMode}
          buttons={[
            { value: 'battery', label: 'Battery saver', icon: 'battery-heart-variant' },
            { value: 'precise', label: 'Precise', icon: 'crosshairs-gps' },
          ]}
        />
        <Button mode="contained" icon={tracking ? 'stop-circle-outline' : 'record-circle-outline'} onPress={toggle} loading={busy} disabled={busy} buttonColor={tracking ? colors.danger : undefined}>
          {tracking ? 'Stop recording' : 'Start recording route'}
        </Button>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
          {points.length} GPS points. Recording keeps running in the background (with a notification on Android) so your route is
          verifiable — GPS-verified distance and altitude power your traveller tier.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button mode="outlined" icon="download" onPress={() => exportFile('gpx')} disabled={clean.length < 2} style={{ flex: 1 }}>
            GPX
          </Button>
          <Button mode="outlined" icon="code-json" onPress={() => exportFile('geojson')} disabled={clean.length < 2} style={{ flex: 1 }}>
            GeoJSON
          </Button>
        </View>
        {canConnect ? (
          <Button
            icon="share-variant"
            disabled={clean.length < 2}
            onPress={() => router.push({ pathname: '/post/new', params: { tripId: trip.id, kind: 'trip' } })}
          >
            Share this route to your feed
          </Button>
        ) : null}
      </View>
    </View>
  );
}
