import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { UserRow } from '../../components/UserRow';
import { useToast } from '../../context/ToastContext';
import { timeAgo } from '../../lib/format';
import { startDirect } from '../../social/chat';
import { clearPresence, getMyPresence, nearbyTravellers, setPresence, type MyPresence } from '../../social/connect';
import { styleLabel, type NearbyTraveller } from '../../social/types';
import { useAppTheme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { Hero } from '../../ui/Hero';
import { Notice } from '../../ui/Notice';
import { Pill } from '../../ui/Pill';
import { SectionHeader } from '../../ui/SectionHeader';

const DURATIONS = [1, 4, 12, 24];
const RADII = [5, 25, 100];

async function currentPosition() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Location permission is needed to find travellers near you.');
  const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
  return (last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))).coords;
}

async function localityLabel(lat: number, lng: number) {
  try {
    const [g] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    return [g?.district || g?.subregion || g?.city, g?.region].filter(Boolean).slice(0, 2).join(', ') || null;
  } catch {
    return null;
  }
}

export function NearbySection() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [presence, setPresenceState] = useState<MyPresence | null | undefined>(undefined);
  const [hours, setHours] = useState(4);
  const [status, setStatus] = useState('');
  const [radius, setRadius] = useState(25);
  const [people, setPeople] = useState<NearbyTraveller[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const mine = await getMyPresence();
      setPresenceState(mine);
      if (!mine) {
        setPeople([]);
        return;
      }
      const c = coords ?? (await currentPosition());
      setCoords(c);
      setPeople(await nearbyTravellers(c.latitude, c.longitude, radius));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load nearby travellers');
    }
  }, [coords, radius]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const goVisible = async () => {
    setBusy(true);
    try {
      const c = await currentPosition();
      setCoords(c);
      const label = await localityLabel(c.latitude, c.longitude);
      await setPresence({ latitude: c.latitude, longitude: c.longitude, hours, placeLabel: label, statusText: status });
      toast(`Visible to nearby travellers for ${hours}h`);
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update visibility');
    } finally {
      setBusy(false);
    }
  };

  const goHidden = async () => {
    setBusy(true);
    try {
      await clearPresence();
      setPresenceState(null);
      setPeople([]);
    } finally {
      setBusy(false);
    }
  };

  const sayHi = async (id: string) => {
    try {
      const conv = await startDirect(id);
      router.push(`/chat/${conv}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start chat');
    }
  };

  if (presence === undefined) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Hero variant="glacier">
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{presence ? 'You are visible nearby' : 'Travellers around you'}</Text>
        <Text style={{ color: '#ffffffd9', marginTop: 4, lineHeight: 20 }}>
          {presence
            ? `${presence.place_label ?? 'Approximate area'} · until ${new Date(presence.expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
            : 'Share an approximate area (about 1 km) for a few hours to see who else is around — for chai, a hike or a shared cab. Only visible while you are visible too.'}
        </Text>
        {presence ? (
          <Button mode="contained" buttonColor="#fff" textColor={colors.tealEnd} style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={goHidden} loading={busy}>
            Stop sharing
          </Button>
        ) : null}
      </Hero>

      {!presence ? (
        <View style={{ marginTop: 14, gap: 10 }}>
          <TextInput mode="outlined" label="Status (optional)" placeholder="Up for momos & a sunset walk" value={status} onChangeText={setStatus} maxLength={140} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {DURATIONS.map(h => (
              <Pill key={h} label={`${h}h`} icon="timer-outline" selected={hours === h} onPress={() => setHours(h)} />
            ))}
          </View>
          <Button mode="contained" icon="map-marker-radius" onPress={goVisible} loading={busy} disabled={busy}>
            Show me nearby for {hours} hour{hours === 1 ? '' : 's'}
          </Button>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
            Your exact location is never shared. Distances are rounded to whole kilometres and your visibility switches off automatically.
          </Text>
        </View>
      ) : (
        <>
          <SectionHeader title={`${people.length} traveller${people.length === 1 ? '' : 's'} nearby`} action="Refresh" onAction={refresh} />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {RADII.map(r => (
              <Pill key={r} label={`${r} km`} selected={radius === r} onPress={() => setRadius(r)} />
            ))}
          </View>
          {error ? <Notice tone="error" text={error} /> : null}
          {people.length ? (
            people.map(p => (
              <UserRow
                key={p.user_id}
                id={p.user_id}
                username={p.username}
                name={p.display_name}
                avatarPath={p.avatar_path}
                tier={p.tier}
                subtitle={[
                  `~${p.distance_km} km`,
                  p.place_label,
                  p.status_text ? `“${p.status_text}”` : null,
                  ...(p.travel_styles ?? []).slice(0, 1).map(styleLabel),
                  `active ${timeAgo(p.updated_at)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                right={<Button compact mode="contained-tonal" onPress={() => sayHi(p.user_id)}>Say hi</Button>}
              />
            ))
          ) : (
            <EmptyState compact icon="radar" title="Nobody visible right now" body="Travellers appear here when they share nearby too. Try a wider radius or check back later." />
          )}
        </>
      )}
    </ScrollView>
  );
}
