import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { useAuth, useCanConnect } from '../../src/context/AuthContext';
import { computeBadges, sortBadges } from '../../src/lib/badges';
import { getRates } from '../../src/lib/currency';
import { formatMoney, sumInCurrency } from '../../src/lib/currencyMath';
import { compactNumber, displayName, formatAltitude, formatKm } from '../../src/lib/format';
import { fillMissingPlaces } from '../../src/lib/reverseGeocode';
import { computeTravelStats, countryName, flagEmoji, spendInYear, type TravelStats } from '../../src/lib/travelStats';
import { loadStatsInput } from '../../src/lib/useTravelStats';
import { normalizeTier, TIER_META } from '../../src/lib/tiers';
import { useAppTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Icon } from '../../src/ui/Icon';
import { Screen } from '../../src/ui/Screen';
import { TAB_BAR_SPACE } from '../../src/ui/GlassTabBar';
import { SectionHeader } from '../../src/ui/SectionHeader';

const HOME_CURRENCY = 'INR';

function Row({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, opacity: pressed ? 0.7 : 1, borderBottomWidth: 1, borderBottomColor: colors.border })}
      accessibilityRole="button"
    >
      <Icon name={icon} size={22} color={colors.onSurface} />
      <Text style={{ flex: 1, fontWeight: '600' }}>{label}</Text>
      <Icon name="chevron-right" size={20} color={colors.subtle} />
    </Pressable>
  );
}

/** One number on the black-and-white stats grid. */
function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ width: '31.5%', paddingVertical: 14, borderRadius: 16, backgroundColor: colors.surfaceVariant, alignItems: 'center' }} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

/** You: a simple, black-and-white profile in the style of a social profile page, without the social parts. */
export default function ProfileTab() {
  const { colors } = useAppTheme();
  const { profile, refreshProfile } = useAuth();
  const signedIn = useCanConnect() && Boolean(profile);
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [spentThisYear, setSpentThisYear] = useState(0);
  const year = new Date().getFullYear();

  const load = useCallback(async () => {
    const compute = async () => {
      const { input } = await loadStatsInput();
      setStats(computeTravelStats(input));
      const rates = await getRates().catch(() => null);
      setSpentThisYear(sumInCurrency(spendInYear(input.expenses ?? [], year), HOME_CURRENCY, rates?.rates ?? null).total);
    };
    await compute();
    // Older moments with a location get their state and country looked up a few at a time.
    if ((await fillMissingPlaces(10).catch(() => 0)) > 0) await compute();
  }, [year]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const badges = useMemo(() => (stats ? sortBadges(computeBadges(stats)) : []), [stats]);
  const earned = badges.filter(b => b.earned);
  const tier = signedIn ? TIER_META[normalizeTier(profile!.tier)].label : null;
  const km = Math.max(stats?.km ?? 0, profile?.verified_km ?? 0);
  const peak = Math.max(stats?.maxAltitudeM ?? 0, profile?.max_altitude_m ?? 0);

  return (
    <Screen refreshing={false} onRefresh={() => { refreshProfile(); load(); }} padded={false} bottomSpace={TAB_BAR_SPACE}>
      {/* The photo sits top left with the buttons beside it; no banner. */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ borderRadius: 48, borderWidth: 4, borderColor: colors.background, backgroundColor: colors.background }}>
            {signedIn ? (
              <Avatar id={profile!.id} name={displayName(profile)} path={profile!.avatar_path} size={84} />
            ) : (
              <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="account-outline" size={40} color={colors.muted} />
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <IconButton icon="cog-outline" mode="outlined" size={18} onPress={() => router.push('/settings')} accessibilityLabel="Settings" />
            {signedIn ? (
              <Button mode="outlined" textColor={colors.onSurface} style={{ borderColor: colors.outline }} onPress={() => router.push('/profile/edit')}>
                Edit profile
              </Button>
            ) : (
              <Button mode="contained" buttonColor={colors.onSurface} textColor={colors.background} onPress={() => router.push('/register')}>
                Create account
              </Button>
            )}
          </View>
        </View>

        <Text variant="headlineSmall" style={{ fontWeight: '900', marginTop: 10 }} numberOfLines={2}>
          {signedIn ? displayName(profile) : 'Your travels'}
        </Text>
        {signedIn && profile!.username ? <Text style={{ color: colors.muted, fontSize: 15 }}>@{profile!.username}</Text> : null}
        {signedIn && profile!.bio ? <Text style={{ marginTop: 10, lineHeight: 21 }}>{profile!.bio}</Text> : null}
        {!signedIn ? (
          <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>Create a free account to back up your journal and pick a username.</Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 10 }}>
          {signedIn && (profile!.home_region || profile!.home_country) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="map-marker-outline" size={15} color={colors.muted} />
              <Text style={{ color: colors.muted }}>{[profile!.home_region, profile!.home_country].filter(Boolean).join(', ')}</Text>
            </View>
          ) : null}
          {tier ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="shield-star-outline" size={15} color={colors.muted} />
              <Text style={{ color: colors.muted }}>{tier}</Text>
            </View>
          ) : null}
        </View>

        {/* The numbers, all from your journal (no "on this device" split). */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          <Stat value={String(stats?.trips ?? 0)} label="Journeys" />
          <Stat value={compactNumber(stats?.entries ?? 0)} label="Moments" />
          <Stat value={formatKm(km)} label="Travelled" />
          <Stat value={String(stats?.countryCodes.length ?? 0)} label="Countries" />
          <Stat value={String(stats?.states.length ?? 0)} label="States" />
          <Stat value={peak ? formatAltitude(peak) : '—'} label="Highest" />
        </View>

        <View
          style={{ marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: colors.surfaceVariant }}
          accessible
          accessibilityLabel={`${formatMoney(spentThisYear, HOME_CURRENCY)} spent on travel in ${year}`}
        >
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>SPENT ON TRAVEL IN {year}</Text>
          <Text style={{ color: colors.onSurface, fontSize: 28, fontWeight: '900', marginTop: 2 }}>{formatMoney(spentThisYear, HOME_CURRENCY)}</Text>
        </View>

        <SectionHeader title="Places you've been" subtitle={stats && (stats.countryCodes.length || stats.states.length) ? `${stats.countryCodes.length} ${stats.countryCodes.length === 1 ? 'country' : 'countries'} · ${stats.states.length} ${stats.states.length === 1 ? 'state' : 'states'}` : undefined} />
        {stats && (stats.countryCodes.length || stats.states.length) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {stats.countryCodes.map(c => (
              <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceVariant }}>
                <Text>{flagEmoji(c)}</Text>
                <Text style={{ fontWeight: '700' }}>{countryName(c)}</Text>
              </View>
            ))}
            {stats.states.map(s => (
              <View key={s} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceVariant }}>
                <Text style={{ fontSize: 13 }}>{s}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            Add your location to a moment (the pin in the moment box) and the states and countries you visit collect here.
          </Text>
        )}

        <Pressable onPress={() => router.push('/wrapped')} accessibilityRole="button" style={{ marginTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.surfaceVariant }}>
            <Icon name="party-popper" size={26} color={colors.onSurface} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', fontSize: 17 }}>Your {year} in travel</Text>
              <Text style={{ color: colors.muted }}>Kilometres, peaks, moods and your traveller persona</Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.subtle} />
          </View>
        </Pressable>

        <SectionHeader title="Badges" subtitle={`${earned.length} of ${badges.length} earned`} action="See all" onAction={() => router.push('/badges')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {badges.slice(0, 8).map(b => (
            <View key={b.id} style={{ width: '22%', alignItems: 'center', opacity: b.earned ? 1 : 0.4 }} accessibilityLabel={`${b.title}${b.earned ? ', earned' : ''}`}>
              <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: b.earned ? b.color : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={b.icon} size={26} color={b.earned ? '#fff' : colors.muted} />
              </View>
              <Text style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }} numberOfLines={2}>
                {b.title}
              </Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Tools" />
        <Row icon="shield-alert-outline" label="Safety center & SOS" onPress={() => router.push('/safety')} />
        <Row icon="swap-horizontal" label="Currency converter" onPress={() => router.push('/tools/currency')} />
        <Row icon="cog-outline" label="Settings & privacy" onPress={() => router.push('/settings')} />
        <View style={{ height: 24 }} />
      </View>
    </Screen>
  );
}
