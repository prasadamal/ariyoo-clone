import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { googleMapsApiKey } from '../../src/config';
import { mapsSupported } from '../../src/lib/mapSupport';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { timeAgo } from '../../src/lib/format';
import { fetchLiveShare, type LiveShareView } from '../../src/lib/liveShare';
import { mapsLink } from '../../src/lib/sosMessage';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Notice } from '../../src/ui/Notice';
import { Screen } from '../../src/ui/Screen';

export default function LiveViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const [data, setData] = useState<LiveShareView | null | undefined>(undefined);

  const load = useCallback(async () => setData(await fetchLiveShare(String(id))), [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (data === undefined) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!data) return <EmptyState icon="map-marker-off-outline" title="Link expired" body="This live location is no longer shared." />;

  const hasFix = data.latitude != null && data.longitude != null;
  const region = hasFix
    ? { latitude: data.latitude as number, longitude: data.longitude as number, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  return (
    <Screen>
      <Text variant="headlineSmall" style={{ fontWeight: '900' }}>
        {data.display_name}
      </Text>
      {data.label ? <Text style={{ color: colors.muted }}>{data.label}</Text> : null}
      {data.active ? (
        <Notice tone="success" icon="broadcast" text={`Live · updated ${timeAgo(data.updated_at)} · until ${new Date(data.expires_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`} />
      ) : (
        <Notice tone="warning" text={`Sharing ended. Last position from ${timeAgo(data.updated_at)} ago.`} />
      )}
      {region && mapsSupported(Platform.OS, googleMapsApiKey) ? (
        <View style={{ height: 360, borderRadius: 18, overflow: 'hidden', marginTop: 8 }}>
          <MapView style={{ flex: 1 }} region={region}>
            <Marker coordinate={region} title={data.display_name} pinColor={colors.primary} />
            {data.accuracy_m ? <Circle center={region} radius={data.accuracy_m} fillColor="#6a01a322" strokeColor="#6a01a366" /> : null}
          </MapView>
        </View>
      ) : region ? null : (
        <Text style={{ color: colors.muted, marginTop: 12 }}>Waiting for the first position…</Text>
      )}
      {hasFix ? (
        <Button mode="contained" icon="map-search-outline" style={{ marginTop: 12 }} onPress={() => Linking.openURL(mapsLink(data.latitude as number, data.longitude as number))}>
          Open in Maps
        </Button>
      ) : null}
      <Button icon="refresh" onPress={load} style={{ marginTop: 6 }}>
        Refresh
      </Button>
    </Screen>
  );
}
