import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Button, IconButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { GuidelinesGate } from '../../src/components/GuidelinesGate';
import type { Destination } from '../../src/content/destinations';
import { useAuth } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import { useToast } from '../../src/context/ToastContext';
import { pickPhotos, type PickedPhoto } from '../../src/features/trip/photoPicker';
import { screenText } from '../../src/lib/contentFilter';
import { dayCount, formatKm } from '../../src/lib/format';
import { trackDistanceKm, elevationStats } from '../../src/lib/geo';
import { getEntry, getTrip, listEntryMedia, listTrackPoints, type LocalTrip } from '../../src/lib/localDb';
import { isAudio } from '../../src/lib/media';
import { matchDestination, placeKeyFor } from '../../src/lib/places';
import { pushTripNow } from '../../src/lib/sync';
import { computeTripStats } from '../../src/lib/tripStats';
import { createPost } from '../../src/social/feed';
import { useAppTheme } from '../../src/theme';
import { Notice } from '../../src/ui/Notice';
import { PlaceField } from '../../src/ui/PlaceField';
import { Screen } from '../../src/ui/Screen';

export default function NewPostScreen() {
  const params = useLocalSearchParams<{ entryId?: string; tripId?: string; kind?: string; placeKey?: string }>();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { syncNow } = useSync();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [placeText, setPlaceText] = useState('');
  const [placeMatch, setPlaceMatch] = useState<Destination | undefined>();
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
  const [trip, setTrip] = useState<LocalTrip | null>(null);
  const [routeKm, setRouteKm] = useState(0);
  const [includeRoute, setIncludeRoute] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  const isTripStory = params.kind === 'trip' && !!params.tripId;

  useEffect(() => {
    (async () => {
      if (params.tripId) {
        const t = await getTrip(String(params.tripId));
        setTrip(t);
        if (t) {
          setPlaceText(t.destination ?? '');
          setPlaceMatch(matchDestination(t.destination ?? ''));
          const points = await listTrackPoints(t.id);
          const km = trackDistanceKm(points);
          setRouteKm(km);
          setIncludeRoute(isTripStory && km >= 0.2);
          if (isTripStory) {
            const s = await computeTripStats(t.id, t);
            const elev = elevationStats(points);
            const nextStats: Record<string, number> = { entries: s.entryCount, photos: s.photoCount };
            const days = dayCount(t.starts_on, t.ends_on);
            if (days) nextStats.days = days;
            if (elev.maxM) nextStats.max_altitude_m = Math.round(elev.maxM);
            setStats(nextStats);
            setBody(
              `${t.title}${t.status === 'completed' ? ' — done! ' : ' '}` +
                [days ? `${days} days` : '', s.entryCount ? `${s.entryCount} moments` : '', km >= 0.2 ? `${formatKm(km)} on foot & wheels` : '']
                  .filter(Boolean)
                  .join(' · ')
            );
          }
        }
      }
      if (params.entryId) {
        const e = await getEntry(String(params.entryId));
        if (e) {
          setBody(e.body && e.body !== '📷' && e.body !== '🎙 Voice note' ? e.body : '');
          if (e.place_name) setPlaceText(prev => prev || e.place_name || '');
          const media = await listEntryMedia(e.id);
          setPhotos(media.filter(m => !isAudio(m.mime_type) && m.local_uri).map(m => ({ uri: m.local_uri })));
        }
      }
      if (params.placeKey) {
        const d = matchDestination(String(params.placeKey));
        if (d) {
          setPlaceText(d.name);
          setPlaceMatch(d);
        }
      }
    })();
  }, [params.entryId, params.tripId, params.placeKey, isTripStory]);

  const addPhotos = async () => {
    try {
      const picked = await pickPhotos(true);
      setPhotos(prev => [...prev, ...picked].slice(0, 10));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add photos');
    }
  };

  const filter = screenText(body);
  const canPost = (body.trim().length > 0 || photos.length > 0 || includeRoute) && filter.ok && !busy;

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      let tripId: string | null = null;
      if (trip) {
        // Linking a trip (and computing its verified route) needs it — and its GPS points — in the cloud.
        if (includeRoute) await syncNow();
        else await pushTripNow(user.id, trip.id);
        tripId = trip.id;
      }
      const id = await createPost({
        body,
        kind: isTripStory ? 'trip' : 'moment',
        photos,
        placeName: placeMatch?.name ?? (placeText.trim() || null),
        placeKey: placeMatch?.key ?? placeKeyFor(placeText),
        tripId,
        includeRoute,
        visibility,
        stats: isTripStory ? stats : null,
      });
      toast('Shared ✨');
      router.replace(`/post/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not post');
    } finally {
      setBusy(false);
    }
  };

  return (
    <GuidelinesGate what="share with travellers">
      <Screen>
        <TextInput
          mode="outlined"
          label={isTripStory ? 'Tell the story of this journey' : 'Share a moment'}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
          style={{ minHeight: 140 }}
          autoFocus={!params.entryId && !isTripStory}
        />
        {!filter.ok ? <Notice tone="warning" text={filter.reason} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {photos.map((p, i) => (
            <Pressable key={p.uri + i} onPress={() => setPhotos(photos.filter((_, j) => j !== i))} accessibilityLabel={`Remove photo ${i + 1}`}>
              <Image source={{ uri: p.uri }} style={{ width: 86, height: 86, borderRadius: 12 }} contentFit="cover" />
              <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#000a', borderRadius: 10 }}>
                <IconButton icon="close" size={12} iconColor="#fff" style={{ margin: 0 }} />
              </View>
            </Pressable>
          ))}
          {photos.length < 10 ? (
            <Pressable
              onPress={addPhotos}
              style={{ width: 86, height: 86, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel="Add photos"
            >
              <IconButton icon="camera-plus-outline" />
            </Pressable>
          ) : null}
        </View>
        <View style={{ marginTop: 14 }}>
          <PlaceField
            label="Where (optional)"
            value={placeText}
            onChange={(t, d) => {
              setPlaceText(t);
              setPlaceMatch(d);
            }}
          />
        </View>
        {trip && routeKm >= 0.2 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: colors.secondaryContainer }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.onSecondaryContainer }}>Show my GPS route ({formatKm(routeKm)})</Text>
              <Text style={{ fontSize: 12, color: colors.onSecondaryContainer }}>
                Shown as a shape with a verified-distance badge. Start and end points are visible — skip it if you started from home.
              </Text>
            </View>
            <Switch value={includeRoute} onValueChange={setIncludeRoute} />
          </View>
        ) : null}
        <Text style={{ fontWeight: '600', marginTop: 16, marginBottom: 6 }}>Who can see this?</Text>
        <SegmentedButtons
          value={visibility}
          onValueChange={v => setVisibility(v as 'public' | 'followers')}
          buttons={[
            { value: 'public', label: 'Everyone', icon: 'earth' },
            { value: 'followers', label: 'Followers', icon: 'account-heart-outline' },
          ]}
        />
        <Button mode="contained" style={{ marginTop: 20 }} onPress={submit} loading={busy} disabled={!canPost}>
          {busy ? 'Sharing…' : 'Share'}
        </Button>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>
          Your private journal is never shared automatically — only what you post here.
        </Text>
      </Screen>
    </GuidelinesGate>
  );
}
