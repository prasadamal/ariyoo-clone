import { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { buildTripGeoJson } from '../../lib/geoExport';
import { startTripTracking, stopTripTracking } from '../../lib/tracking';
import { RouteMap } from '../RouteMap';

type Props = {
  tripId: string;
  title: string;
  route: { latitude: number; longitude: number }[];
  tracking: boolean;
  onChanged: () => void;
};

export function RouteSection({ tripId, title, route, tracking, onChanged }: Props) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      if (tracking) await stopTripTracking();
      else await startTripTracking(tripId);
    } catch (e) {
      Alert.alert('Route recording', e instanceof Error ? e.message : 'Could not start recording.');
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const exportRoute = async () => {
    const geo = await buildTripGeoJson(tripId, title);
    await Share.share({ message: JSON.stringify(geo), title: `${title} route (GeoJSON)` });
  };

  return (
    <View>
      <RouteMap points={route} />
      <Text variant="bodyMedium">{route.length} GPS points{tracking ? ' · recording…' : ''}</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
        Recording continues with the screen off and shows a notification until you stop it.
      </Text>
      <Button mode="contained" style={{ marginTop: 12 }} onPress={toggle} loading={busy} icon={tracking ? 'stop' : 'record-circle-outline'}>
        {tracking ? 'Stop recording' : 'Start recording route'}
      </Button>
      <Button mode="outlined" style={{ marginTop: 8 }} onPress={exportRoute} disabled={route.length < 2}>
        Share route (GeoJSON)
      </Button>
    </View>
  );
}
