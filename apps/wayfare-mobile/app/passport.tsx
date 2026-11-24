import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { captureRef } from 'react-native-view-shot';
import { passportStamps, stampMonth, stampTilt, type PassportStamp } from '../src/lib/passport';
import { countryName, flagEmoji, stateWord } from '../src/lib/travelStats';
import { loadStatsInput } from '../src/lib/useTravelStats';
import { useAppTheme } from '../src/theme';

// Ink colours for the stamps, picked per country so a country keeps its colour.
const INKS = ['#6a01a3', '#b45309', '#0e7490', '#be185d', '#4d7c0f', '#1d4ed8', '#9f1239', '#7c2d12'];
const inkFor = (code: string) => INKS[(code.charCodeAt(0) + code.charCodeAt(1)) % INKS.length];

function Stamp({ s }: { s: PassportStamp }) {
  const ink = s.upcoming ? '#a1a1aa' : inkFor(s.code);
  return (
    <View
      accessible
      accessibilityLabel={`${countryName(s.code)}, ${s.upcoming ? 'coming up' : 'first visited'} ${stampMonth(s.firstDay)}`}
      style={{
        width: '48%',
        borderWidth: 2,
        borderStyle: s.upcoming ? 'dotted' : 'dashed',
        borderColor: ink,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        transform: [{ rotate: `${stampTilt(s.code)}deg` }],
        opacity: s.upcoming ? 0.75 : 1,
      }}
    >
      <Text style={{ fontSize: 30 }}>{flagEmoji(s.code)}</Text>
      <Text style={{ color: ink, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>
        {countryName(s.code)}
      </Text>
      <Text style={{ color: ink, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
        {stampMonth(s.firstDay)}
        {s.upcoming ? ' · SOON' : s.states > 1 ? ` · ${s.states} ${stateWord(s.code, s.states).toUpperCase()}` : ''}
      </Text>
    </View>
  );
}

/** Passport: an ink stamp for every country you've been to, dated with your first visit. */
export default function PassportScreen() {
  const { colors } = useAppTheme();
  const [stamps, setStamps] = useState<PassportStamp[] | null>(null);
  const [sharing, setSharing] = useState(false);
  const page = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadStatsInput()
        .then(({ input }) => alive && setStamps(passportStamps(input.trips, input.entries)))
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
            {stamps.map(s => (
              <Stamp key={s.code} s={s} />
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Your first stamp appears when you write a moment abroad, or start a journey to a destination from the list.
          </Text>
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
