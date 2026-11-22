import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useCanConnect } from '../../src/context/AuthContext';
import { computeBadges, sortBadges } from '../../src/lib/badges';
import { getRates } from '../../src/lib/currency';
import { formatMoney, sumInCurrency } from '../../src/lib/currencyMath';
import { displayName, formatKm } from '../../src/lib/format';
import { fillMissingPlaces } from '../../src/lib/reverseGeocode';
import { computeTravelStats, countryName, flagEmoji, spendInYear, type TravelStats } from '../../src/lib/travelStats';
import { loadStatsInput } from '../../src/lib/useTravelStats';
import { useAppTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Icon } from '../../src/ui/Icon';
import { Screen } from '../../src/ui/Screen';
import { TAB_BAR_SPACE } from '../../src/ui/GlassTabBar';

const HOME_CURRENCY = 'INR';
/** Places beyond this many fold into "+N more". */
const PLACES_SHOWN = 8;

/** A small heading with an optional link on the right. */
function Heading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 10 }}>
      <Text style={{ flex: 1, fontSize: 17, fontWeight: '800' }} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One number in the stats row. */
function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: colors.surfaceVariant, alignItems: 'center' }} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

/**
 * You: who you are and where you've been, kept short. Settings sit behind the gear; safety and the
 * currency converter live on the Journeys screen, so they aren't repeated here.
 */
export default function ProfileTab() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const signedIn = useCanConnect() && Boolean(profile);
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [spentThisYear, setSpentThisYear] = useState(0);
  const [allPlaces, setAllPlaces] = useState(false);
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
  const earned = badges.filter(b => b.earned).length;
  const km = Math.max(stats?.km ?? 0, profile?.verified_km ?? 0);
  const places = [
    ...(stats?.countryCodes ?? []).map(c => ({ key: `c-${c}`, label: countryName(c), flag: flagEmoji(c) })),
    ...(stats?.states ?? []).map(s => ({ key: `s-${s}`, label: s, flag: null as string | null })),
  ];
  const shownPlaces = allPlaces ? places : places.slice(0, PLACES_SHOWN);
  const home = signedIn ? [profile!.home_region, profile!.home_country].filter(Boolean).join(', ') : '';

  return (
    <Screen refreshing={false} onRefresh={() => { refreshProfile(); load(); }} padded={false} bottomSpace={TAB_BAR_SPACE}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
        {/* Who you are */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {signedIn ? (
            <Avatar id={profile!.id} name={displayName(profile)} path={profile!.avatar_path} size={72} />
          ) : (
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="account-outline" size={36} color={colors.muted} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text variant="titleLarge" style={{ fontWeight: '900' }} numberOfLines={1}>
              {signedIn ? displayName(profile) : 'Your travels'}
            </Text>
            {signedIn && profile!.username ? (
              <Text style={{ color: colors.muted }} numberOfLines={1}>
                @{profile!.username}
              </Text>
            ) : null}
            {home ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Icon name="map-marker-outline" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
                  {home}
                </Text>
              </View>
            ) : null}
          </View>
          <IconButton icon="cog-outline" onPress={() => router.push('/settings')} accessibilityLabel="Settings" style={{ margin: 0, alignSelf: 'flex-start' }} />
        </View>

        {signedIn && profile!.bio ? <Text style={{ marginTop: 12, lineHeight: 21 }}>{profile!.bio}</Text> : null}
        {signedIn ? (
          <Button mode="outlined" onPress={() => router.push('/profile/edit')} style={{ marginTop: 14 }}>
            Edit profile
          </Button>
        ) : (
          <>
            <Text style={{ color: colors.muted, marginTop: 12, lineHeight: 20 }}>Create a free account to back up your journal and pick a username.</Text>
            <Button mode="contained" onPress={() => router.push('/register')} style={{ marginTop: 12 }}>
              Create account
            </Button>
          </>
        )}

        {/* The three numbers that matter */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
          <Stat value={String(stats?.trips ?? 0)} label={(stats?.trips ?? 0) === 1 ? 'Journey' : 'Journeys'} />
          <Stat value={String(stats?.countryCodes.length ?? 0)} label={(stats?.countryCodes.length ?? 0) === 1 ? 'Country' : 'Countries'} />
          <Stat value={formatKm(km)} label="Travelled" />
        </View>

        {/* This year: spending, and the way into the year in travel */}
        <Pressable onPress={() => router.push('/wrapped')} accessibilityRole="button" accessibilityLabel={`${formatMoney(spentThisYear, HOME_CURRENCY)} spent on travel in ${year}. Open your year in travel`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 16, borderRadius: 16, backgroundColor: colors.surfaceVariant }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>YOUR {year}</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', marginTop: 2 }}>{formatMoney(spentThisYear, HOME_CURRENCY)}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>spent on travel · see your year in travel</Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.subtle} />
          </View>
        </Pressable>

        {/* Places */}
        <Heading title="Places you've been" />
        {places.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {shownPlaces.map(p => (
              <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceVariant, maxWidth: '100%' }}>
                {p.flag ? <Text>{p.flag}</Text> : null}
                <Text style={{ fontWeight: p.flag ? '700' : '500', flexShrink: 1 }} numberOfLines={1}>
                  {p.label}
                </Text>
              </View>
            ))}
            {places.length > PLACES_SHOWN ? (
              <Pressable onPress={() => setAllPlaces(v => !v)} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{allPlaces ? 'Show less' : `+${places.length - PLACES_SHOWN} more`}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={{ color: colors.muted, lineHeight: 20 }}>Turn on the location pin when you add a moment, and the places you visit collect here.</Text>
        )}

        {/* Badges */}
        <Heading title={`Badges · ${earned} of ${badges.length}`} action="See all" onAction={() => router.push('/badges')} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {badges.slice(0, 4).map(b => (
            <View key={b.id} style={{ flex: 1, alignItems: 'center', opacity: b.earned ? 1 : 0.45 }} accessible accessibilityLabel={`${b.title}${b.earned ? ', earned' : ''}`}>
              <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: b.earned ? b.color : colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={b.icon} size={26} color={b.earned ? '#fff' : colors.muted} />
              </View>
              <Text style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }} numberOfLines={2}>
                {b.title}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ height: 16 }} />
      </View>
    </Screen>
  );
}
