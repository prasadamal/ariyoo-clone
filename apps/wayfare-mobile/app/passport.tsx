import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { isCodeList, newStampCodes, parseSeen, stampDelay } from '../src/lib/celebrations';
import { passportStamps, stampMonth, stampTilt, type PassportStamp } from '../src/lib/passport';
import { countryName, flagEmoji, stateWord } from '../src/lib/travelStats';
import { loadStatsInput } from '../src/lib/useTravelStats';
import { useAppTheme } from '../src/theme';
import { EmptyState } from '../src/ui/EmptyState';
import { Lottie, lottieAvailable } from '../src/ui/Lottie';

// Ink colours for the stamps, picked per country so a country keeps its colour.
const INKS = ['#6a01a3', '#b45309', '#0e7490', '#be185d', '#4d7c0f', '#1d4ed8', '#9f1239', '#7c2d12'];
const inkFor = (code: string) => INKS[(code.charCodeAt(0) + code.charCodeAt(1)) % INKS.length];
const SEEN_KEY = 'wayfare_passport_seen_v1';
const LAND_MS = 340;

/** One stamp. `land` drops it onto the page (big and faint to its size), with an ink splash as it hits. */
function Stamp({ s, land, delay }: { s: PassportStamp; land: boolean; delay: number }) {
  const ink = s.upcoming ? '#a1a1aa' : inkFor(s.code);
  const tilt = stampTilt(s.code);
  const scale = useSharedValue(land ? 1.6 : 1);
  const fade = useSharedValue(land ? 0 : 1);
  const [splash, setSplash] = useState(false);

  useEffect(() => {
    if (!land) return;
    scale.value = 1.6;
    fade.value = 0;
    fade.value = withDelay(delay, withTiming(1, { duration: 140 }));
    scale.value = withDelay(delay, withTiming(1, { duration: LAND_MS, easing: Easing.in(Easing.cubic) }));
    const hit = setTimeout(() => {
      setSplash(true);
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }, delay + LAND_MS);
    return () => clearTimeout(hit);
  }, [land, delay, fade, scale]);

  const style = useAnimatedStyle(() => ({ opacity: fade.value * (s.upcoming ? 0.75 : 1), transform: [{ rotate: `${tilt}deg` }, { scale: scale.value }] }));

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${countryName(s.code)}, ${s.upcoming ? 'coming up' : 'first visited'} ${stampMonth(s.firstDay)}`}
      style={[
        {
          width: '48%',
          borderWidth: 2,
          borderStyle: s.upcoming ? 'dotted' : 'dashed',
          borderColor: ink,
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 8,
          alignItems: 'center',
        },
        style,
      ]}
    >
      {splash && lottieAvailable ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%', width: 260, height: 260, marginLeft: -130, marginTop: -130 }}>
          <Lottie name="stamp" tint={ink} style={{ width: 260, height: 260 }} onFinish={() => setSplash(false)} />
        </View>
      ) : null}
      <Text style={{ fontSize: 30 }}>{flagEmoji(s.code)}</Text>
      <Text style={{ color: ink, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>
        {countryName(s.code)}
      </Text>
      <Text style={{ color: ink, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
        {stampMonth(s.firstDay)}
        {s.upcoming ? ' · SOON' : s.states > 1 ? ` · ${s.states} ${stateWord(s.code, s.states).toUpperCase()}` : ''}
      </Text>
    </Animated.View>
  );
}

/** Passport: an ink stamp for every country you've been to, dated with your first visit. */
export default function PassportScreen() {
  const { colors } = useAppTheme();
  const [stamps, setStamps] = useState<PassportStamp[] | null>(null);
  // Countries stamped since you last opened the passport (all of them, the first time) land on the page.
  const [landing, setLanding] = useState<string[]>([]);
  const reduceMotion = useReducedMotion();
  const [sharing, setSharing] = useState(false);
  const page = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([loadStatsInput(), AsyncStorage.getItem(SEEN_KEY).catch(() => null)])
        .then(async ([{ input }, raw]) => {
          const list = passportStamps(input.trips, input.entries);
          const fresh = newStampCodes(parseSeen(raw, isCodeList), list);
          await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(list.filter(x => !x.upcoming).map(x => x.code))).catch(() => undefined);
          if (!alive) return;
          setLanding(fresh);
          setStamps(list);
        })
        .catch(() => alive && setStamps([]));
      return () => {
        alive = false;
      };
    }, [])
  );

  if (!stamps) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  const visited = stamps.filter(s => !s.upcoming);
  const since = visited[0] ? stampMonth(visited[0].firstDay).toLowerCase().replace(/^./, c => c.toUpperCase()) : null;

  const share = async () => {
    setSharing(true);
    try {
      const uri = await captureRef(page, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'My passport' });
      else await Share.share({ message: `${visited.length} countries on Wayfare` });
    } catch {
      // cancelled
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View ref={page} collapsable={false} style={{ backgroundColor: colors.background, paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text variant="headlineSmall" style={{ fontWeight: '900' }}>
            {visited.length} {visited.length === 1 ? 'country' : 'countries'}
          </Text>
          {since ? <Text style={{ color: colors.muted }}>since {since}</Text> : null}
        </View>
        {stamps.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 }}>
            {stamps.map(s => {
              const at = landing.indexOf(s.code);
              return <Stamp key={s.code} s={s} land={at >= 0 && !reduceMotion} delay={stampDelay(at)} />;
            })}
          </View>
        ) : (
          <EmptyState
            icon="earth"
            animation="travel"
            title="No stamps yet"
            body="Your first stamp appears when you write a moment abroad, or start a journey to a destination from the list."
            action="Start a journey"
            onAction={() => router.push('/trip/new')}
          />
        )}
      </View>
      {visited.length ? (
        <Button mode="contained" icon="share-variant" onPress={share} loading={sharing} disabled={sharing} style={{ marginTop: 22, alignSelf: 'center' }}>
          Share my passport
        </Button>
      ) : null}
    </ScrollView>
  );
}
