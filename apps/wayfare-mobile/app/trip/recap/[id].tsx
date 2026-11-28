import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../../../src/context/AuthContext';
import { useToast } from '../../../src/context/ToastContext';
import { tripRole } from '../../../src/lib/crewRules';
import { isEverydayTrip } from '../../../src/lib/everydayMemories';
import { shareTripStory } from '../../../src/lib/shareTrip';
import { sharedMessage } from '../../../src/lib/storyLink';
import { getRates } from '../../../src/lib/currency';
import { formatMoney, splitSpend } from '../../../src/lib/currencyMath';
import { dayCount, formatDateRange, formatKm } from '../../../src/lib/format';
import { getTrip, type LocalTrip } from '../../../src/lib/localDb';
import { track } from '../../../src/lib/telemetry';
import { tripCoverUri } from '../../../src/lib/tripCover';
import { computeTripStats, type TripStats } from '../../../src/lib/tripStats';
import { useAppTheme } from '../../../src/theme';
import { Confetti } from '../../../src/ui/Confetti';
import { coverArtFor } from '../../../src/ui/coverArt';

const LOGO = require('../../../assets/logo-mark.png');

/** A one-tap picture of a journey (cover, days, moments, photos, km, spend) to share anywhere. */
export default function TripRecapScreen() {
  // celebrate=1: opened by "Complete & see recap", so the journey's end gets a burst of confetti.
  const { id, celebrate } = useLocalSearchParams<{ id: string; celebrate?: string }>();
  const { colors } = useAppTheme();
  const card = useRef<View>(null);
  const [trip, setTrip] = useState<LocalTrip | null>(null);
  const [stats, setStats] = useState<TripStats | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [spent, setSpent] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [burst, setBurst] = useState(0);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      const t = await getTrip(id);
      if (!t) return;
      setTrip(t);
      const s = await computeTripStats(t.id, t);
      setStats(s);
      if (celebrate === '1') setBurst(1);
      setCover(await tripCoverUri(t).catch(() => null));
      const rates = await getRates().catch(() => null);
      const total = splitSpend(s.spendByCurrency, t.currency || 'INR', rates?.rates ?? null).total;
      setSpent(total > 0 ? formatMoney(total, t.currency || 'INR', { compact: true }) : null);
    })().catch(() => undefined);
  }, [id, celebrate]);

  const share = async () => {
    if (!trip) return;
    setSharing(true);
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: trip.title });
      else await Share.share({ message: `${trip.title} — journaled on Wayfare` });
      void track('recap_shared');
    } catch {
      await Share.share({ message: `${trip.title} — journaled on Wayfare` }).catch(() => undefined);
    } finally {
      setSharing(false);
    }
  };

  /**
   * The journey's own page for family and friends: they read it day by day in a browser, without the
   * app, and can't change anything. The first time asks first (it makes the moments readable by link).
   */
  const shareLink = () => {
    if (!trip || !user || linking) return;
    const go = async () => {
      setLinking(true);
      try {
        const r = await shareTripStory(trip, user.id);
        const note = sharedMessage(r.pendingUploads);
        if (note) toast(note);
        setTrip((await getTrip(trip.id)) ?? trip);
      } catch (e) {
        Alert.alert('Link not shared', e instanceof Error ? e.message : 'Could not share the link');
      } finally {
        setLinking(false);
      }
    };
    if (trip.visibility === 'link') return void go();
    Alert.alert(
      'Share a trip link?',
      'Anyone with the link can read this journey\u2019s moments, photos, moods and place names, day by day, without the app. They can read it, not change it. Money, routes, weather and voice notes stay private. You can stop sharing any time from the journey\u2019s menu.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Share link', onPress: () => void go() }]
    );
  };

  if (!trip || !stats) return <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />;
  // Only the owner, signed in, can make the link (the page reads the backed-up copy).
  const canLink = Boolean(user) && tripRole(trip) === 'owner' && !isEverydayTrip(trip);
  const days = Math.max(dayCount(trip.starts_on, trip.ends_on), 1);
  const facts = [
    { value: String(days), label: days === 1 ? 'day' : 'days' },
    { value: String(stats.entryCount), label: stats.entryCount === 1 ? 'moment' : 'moments' },
    { value: String(stats.photoCount), label: stats.photoCount === 1 ? 'photo' : 'photos' },
    stats.distanceKm >= 0.5 ? { value: formatKm(stats.distanceKm), label: 'travelled' } : null,
    spent ? { value: spent, label: 'spent' } : null,
  ].filter(Boolean) as { value: string; label: string }[];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center', backgroundColor: colors.background, flexGrow: 1 }}>
      {/* The picture that gets shared: square-ish, cover on top, the journey in numbers below. */}
      <View ref={card} collapsable={false} style={{ width: '100%', maxWidth: 420, borderRadius: 28, overflow: 'hidden', backgroundColor: '#ffffff' }}>
        <View style={{ height: 230 }}>
          <Image source={cover ? { uri: cover } : coverArtFor(trip.trip_type)} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.65)']} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }} numberOfLines={2}>
              {trip.title}
            </Text>
            <Text style={{ color: '#ffffffd9', marginTop: 2 }}>{[trip.destination, formatDateRange(trip.starts_on, trip.ends_on)].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 14, gap: 8 }}>
          {facts.map(f => (
            <View key={f.label} style={{ flexGrow: 1, minWidth: '30%', padding: 12, borderRadius: 16, backgroundColor: '#f3ecf8', alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#3f0263' }} numberOfLines={1} adjustsFontSizeToFit>
                {f.value}
              </Text>
              <Text style={{ fontSize: 12, color: '#6b5a78' }}>{f.label}</Text>
            </View>
          ))}
        </View>
        {stats.topMood ? <Text style={{ textAlign: 'center', color: '#6b5a78', marginTop: -4 }}>Mood of the trip: {stats.topMood}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
          <Image source={LOGO} style={{ width: 34, height: 19 }} contentFit="contain" />
          <Text style={{ color: '#6a01a3', fontWeight: '800' }}>Journaled on Wayfare</Text>
        </View>
      </View>
      <Button mode="contained" icon="share-variant" onPress={share} loading={sharing} disabled={sharing} style={{ marginTop: 20, alignSelf: 'stretch' }} contentStyle={{ height: 48 }}>
        Share Recap
      </Button>
      {canLink ? (
        <Button mode="outlined" icon="link-variant" onPress={shareLink} loading={linking} disabled={linking} style={{ marginTop: 10, alignSelf: 'stretch' }} contentStyle={{ height: 48 }}>
          {trip.visibility === 'link' ? 'Share trip link again' : 'Share trip link (read-only)'}
        </Button>
      ) : null}
      <Button onPress={() => router.back()} style={{ marginTop: 6 }}>
        Done
      </Button>
    </ScrollView>
    <Confetti burst={burst} />
    </View>
  );
}
