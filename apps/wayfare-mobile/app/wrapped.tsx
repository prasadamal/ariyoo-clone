import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../src/context/AuthContext';
import { formatKm } from '../src/lib/format';
import { loadStatsInput } from '../src/lib/useTravelStats';
import { buildWrapped, whereYouWent, type WrappedSummary } from '../src/lib/wrapped';
import { Icon } from '../src/ui/Icon';
import { countryName, flagEmoji } from '../src/lib/travelStats';
import { Image } from 'expo-image';

const LOGO = require('../assets/logo-mark.png');
import { Pill } from '../src/ui/Pill';

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ width: '50%', paddingVertical: 10 }}>
      <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: '#ffffffcc', fontSize: 13 }}>{label}</Text>
    </View>
  );
}

export default function WrappedScreen() {
  const { profile } = useAuth();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [summary, setSummary] = useState<WrappedSummary | null>(null);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    setSummary(null);
    loadStatsInput().then(({ input, media }) => setSummary(buildWrapped(year, input, media)));
  }, [year]);

  // The year's character: one short value each (no long sentences, no money).
  const tiles = useMemo(() => {
    if (!summary) return [] as { label: string; value: string }[];
    const out: { label: string; value: string }[] = [];
    const st = summary.stats;
    if (summary.topMood) out.push({ label: 'Mood of the year', value: summary.topMood });
    if (summary.busiestMonth) out.push({ label: 'Busiest month', value: summary.busiestMonth });
    if (st.longestTripDays >= 2) out.push({ label: 'Longest trip', value: `${st.longestTripDays} days` });
    if (st.longestStreakDays >= 2) out.push({ label: 'Writing streak', value: `${st.longestStreakDays} days` });
    else if (st.voiceNotes) out.push({ label: 'Voice notes', value: String(st.voiceNotes) });
    return out.slice(0, 4); // a lone last tile stretches to the full width
  }, [summary]);

  const went = useMemo(() => (summary ? whereYouWent(summary, { flag: flagEmoji, country: countryName }) : null), [summary]);

  const share = async () => {
    if (!summary) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `My ${year} in travel` });
      } else {
        await Share.share({ message: `My ${year} in travel on Wayfare: ${summary.persona.title}` });
      }
    } catch {
      await Share.share({
        message: `My ${year} in travel 🌏 ${summary.stats.trips} ${summary.stats.trips === 1 ? 'journey' : 'journeys'} · ${formatKm(summary.stats.km)} · ${summary.persona.title} — via Wayfare`,
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <LinearGradient colors={['#1c1917', '#2a0045', '#3f0263']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
          <IconButton icon="close" iconColor="#fff" onPress={() => router.back()} accessibilityLabel="Close" />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {[thisYear - 1, thisYear].map(y => (
              <Pill key={y} label={String(y)} selected={y === year} onPress={() => setYear(y)} color="#fff" background="#ffffff22" />
            ))}
          </View>
          <View style={{ width: 48 }} />
        </View>
        {!summary ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 60 }} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View ref={cardRef} collapsable={false} style={{ borderRadius: 28, overflow: 'hidden' }}>
              <LinearGradient colors={['#6a01a3', '#3f0263', '#4c1d95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22 }}>
                <Text style={{ color: '#ffffffcc', fontWeight: '800', letterSpacing: 2 }}>WAYFARE · {summary.year}</Text>
                <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 8, lineHeight: 38 }}>
                  {profile?.display_name ? `${profile.display_name.split(' ')[0]}’s` : 'My'} year in travel
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 12, borderRadius: 18, backgroundColor: '#ffffff1f' }}>
                  <Icon name={summary.persona.icon} size={34} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{summary.persona.title}</Text>
                    <Text style={{ color: '#ffffffd9' }}>{summary.persona.blurb}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                  <BigStat value={String(summary.stats.trips)} label={summary.stats.trips === 1 ? 'journey' : 'journeys'} />
                  <BigStat value={formatKm(summary.stats.km)} label="on recorded routes" />
                  <BigStat value={String(summary.stats.entries)} label={summary.stats.entries === 1 ? 'moment written' : 'moments written'} />
                  <BigStat value={summary.stats.maxAltitudeM ? `${summary.stats.maxAltitudeM.toLocaleString('en-IN')} m` : '—'} label="highest point" />
                  <BigStat value={String(summary.stats.photos)} label={summary.stats.photos === 1 ? 'photo' : 'photos'} />
                  <BigStat value={String(summary.stats.destinations)} label={summary.stats.destinations === 1 ? 'destination' : 'destinations'} />
                </View>
                {/* Where you went: a statement to show off, not a list to tap. */}
                {went ? (
                  <View style={{ marginTop: 14, padding: 16, borderRadius: 18, backgroundColor: '#ffffff14' }}>
                    <Text style={{ color: '#ffffffb3', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>WHERE YOU WENT</Text>
                    <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 2 }}>
                      {went.count} {went.noun}
                    </Text>
                    <Text style={{ color: '#ffffffe6', fontSize: 15, lineHeight: 24, marginTop: 6 }}>
                      {went.items.map(i => (i.flag ? `${i.flag}\u00a0${i.name.replace(/ /g, '\u00a0')}` : i.name.replace(/ /g, '\u00a0'))).join('   ')}
                    </Text>
                  </View>
                ) : null}

                {/* The year's character in four small tiles. */}
                {tiles.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {tiles.map(t => (
                      <View key={t.label} style={{ width: '48.5%', flexGrow: 1, padding: 12, borderRadius: 16, backgroundColor: '#ffffff14' }}>
                        <Text style={{ color: '#ffffffb3', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>{t.label.toUpperCase()}</Text>
                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                          {t.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 }}>
                  <Image source={LOGO} style={{ width: 30, height: 17 }} contentFit="contain" tintColor="#ffffff" />
                  <Text style={{ color: '#ffffffb3', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>JOURNALED ON WAYFARE</Text>
                </View>
              </LinearGradient>
            </View>
            <Button mode="contained" icon="share-variant" buttonColor="#fff" textColor="#3f0263" style={{ marginTop: 18 }} onPress={share} loading={sharing} disabled={sharing}>
              Share my year
            </Button>
            {summary.stats.trips === 0 ? (
              <Button textColor="#fff" style={{ marginTop: 8 }} onPress={() => router.replace('/trip/new')}>
                Start a journey for next year’s story
              </Button>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}
