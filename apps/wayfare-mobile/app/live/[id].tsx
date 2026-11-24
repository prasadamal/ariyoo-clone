import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { timeAgo, timeAgoPhrase } from '../../src/lib/format';
import { fetchLiveShare, type LiveShareView } from '../../src/lib/liveShare';
import { mapsLink } from '../../src/lib/sosMessage';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Notice } from '../../src/ui/Notice';
import { Screen } from '../../src/ui/Screen';
import { mapAvailable, TripMap } from '../../src/ui/TripMap';

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
  const pin = hasFix ? [{ id: 'person', kind: 'person' as const, latitude: data.latitude as number, longitude: data.longitude as number }] : [];

  return (
    <Screen>
      <Text variant="headlineSmall" style={{ fontWeight: '900' }}>
        {data.display_name}
      </Text>
      {data.label ? <Text style={{ color: colors.muted }}>{data.label}</Text> : null}
      {data.active ? (
        <Notice tone="success" icon="broadcast" text={`Live · updated ${timeAgo(data.updated_at)} · until ${new Date(data.expires_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`} />
      ) : (
        <Notice tone="warning" text={`Sharing ended. Last position from ${timeAgoPhrase(data.updated_at)}.`} />
      )}
      {hasFix && mapAvailable ? (
        <TripMap pins={pin} style={{ height: 360, borderRadius: 18, marginTop: 8 }} />
      ) : hasFix ? null : (
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
