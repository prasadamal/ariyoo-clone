import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../src/context/AuthContext';
import { formatMoney } from '../src/lib/currencyMath';
import { formatKm } from '../src/lib/format';
import { loadStatsInput } from '../src/lib/useTravelStats';
import { buildWrapped, type WrappedSummary } from '../src/lib/wrapped';
import { Icon } from '../src/ui/Icon';
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

  const spend = useMemo(
    () =>
      summary
        ? Object.entries(summary.spendByCurrency)
            .map(([c, v]) => formatMoney(v, c, { compact: true }))
            .join(' + ')
        : '',
    [summary]
  );

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
        message: `My ${year} in travel 🌏 ${summary.stats.trips} journeys · ${formatKm(summary.stats.km)} · ${summary.persona.title} — via Wayfare`,
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
                  <BigStat value={String(summary.stats.trips)} label="journeys" />
                  <BigStat value={formatKm(summary.stats.km)} label="on recorded routes" />
                  <BigStat value={String(summary.stats.entries)} label="moments written" />
                  <BigStat value={summary.stats.maxAltitudeM ? `${summary.stats.maxAltitudeM.toLocaleString('en-IN')} m` : '—'} label="highest point" />
                  <BigStat value={String(summary.stats.photos)} label="photos" />
                  <BigStat value={String(summary.stats.destinations)} label="destinations" />
                </View>
                {summary.destinations.length ? (
                  <Text style={{ color: '#fff', marginTop: 10, lineHeight: 21 }}>
                    <Text style={{ fontWeight: '900' }}>Went to </Text>
                    {summary.destinations.slice(0, 6).join(' · ')}
                  </Text>
                ) : null}
                {summary.topMood || summary.busiestMonth ? (
                  <Text style={{ color: '#ffffffd9', marginTop: 8 }}>
                    {[summary.topMood ? `Mood of the year: ${summary.topMood}` : null, summary.busiestMonth ? `Busiest month: ${summary.busiestMonth}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
                {summary.highlights.length ? (
                  <View style={{ marginTop: 12, gap: 4 }}>
                    {summary.highlights.map(h => (
                      <Text key={h} style={{ color: '#fff' }}>
                        ✦ {h}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {spend ? <Text style={{ color: '#ffffffb3', marginTop: 10, fontSize: 12 }}>Spent on adventures: {spend}</Text> : null}
                <Text style={{ color: '#ffffff99', marginTop: 18, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>YOUR JOURNEY, JOURNALED · WAYFARE</Text>
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
