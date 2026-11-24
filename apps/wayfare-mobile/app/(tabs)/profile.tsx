import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useCanConnect } from '../../src/context/AuthContext';
import { computeBadges, sortBadges } from '../../src/lib/badges';
import { displayName, formatKm } from '../../src/lib/format';
import { fillMissingPlaces } from '../../src/lib/reverseGeocode';
import { computeTravelStats, countryName, countryPlaces, countrySummary, flagEmoji, type TravelStats } from '../../src/lib/travelStats';
import { loadMemberNumber } from '../../src/social/memberNumber';
import { Pill } from '../../src/ui/Pill';
import { loadStatsInput } from '../../src/lib/useTravelStats';
import { useAppTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Icon } from '../../src/ui/Icon';
import { Screen } from '../../src/ui/Screen';
import { TAB_BAR_SPACE } from '../../src/ui/GlassTabBar';

/** A rounded light tile: every block on this page sits in one. */
function Tile({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginTop: 12, padding: 16, borderRadius: 20, backgroundColor: colors.surfaceVariant }}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '800' }} accessibilityRole="header">
            {title}
          </Text>
          {action ?? null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** One number in the stats row. */
function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, paddingVertical: 14, borderRadius: 18, backgroundColor: colors.surfaceVariant, alignItems: 'center' }} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

/** The year in travel: a softly moving brand gradient with the year in the middle; tap to open. */
function YearTile({ year }: { year: number }) {
  const { colors } = useAppTheme();
  const shift = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shift, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(shift, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shift]);
  const translateX = shift.interpolate({ inputRange: [0, 1], outputRange: [0, -width * 2] });
  return (
    <Pressable
      onPress={() => router.push('/wrapped')}
      accessibilityRole="button"
      accessibilityLabel={`Your ${year} year so far`}
      style={({ pressed }) => ({ marginTop: 12, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        style={{ height: 92, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { width: width * 3 || '300%', opacity: 0.38, transform: [{ translateX }] }]}>
          <LinearGradient
            colors={[colors.primary, colors.secondary, colors.primary, colors.secondary]}
            start={{ x: 0, y: 0.3 }}
            end={{ x: 1, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Text style={{ fontSize: 34, fontWeight: '900', letterSpacing: 1, color: colors.onSurface, lineHeight: 38 }}>{year}</Text>
        <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1.5, color: colors.onSurface, opacity: 0.75 }}>YEAR SO FAR</Text>
      </View>
    </Pressable>
  );
}

/** You: who you are and where you've been, in a few calm tiles. Settings sit behind the gear. */
export default function ProfileTab() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const signedIn = useCanConnect() && Boolean(profile);
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [openCountry, setOpenCountry] = useState<string | null>(null);
  const [memberNo, setMemberNo] = useState<number | null>(null);
  const year = new Date().getFullYear();

  const load = useCallback(async () => {
    const compute = async () => setStats(computeTravelStats((await loadStatsInput()).input));
    await compute();
    // Older moments with a location get their state and country looked up a few at a time.
    if ((await fillMissingPlaces(10).catch(() => 0)) > 0) await compute();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  // "You're our 452nd traveller": shown as the first badge.
  useEffect(() => {
    if (signedIn && profile?.id) loadMemberNumber(profile.id).then(setMemberNo).catch(() => undefined);
  }, [signedIn, profile?.id]);

  const allBadgeList = useMemo(() => (stats ? sortBadges(computeBadges(stats)) : []), [stats]);
  const earned = allBadgeList.filter(b => b.earned);
  const allBadges = allBadgeList.length;
  const km = Math.max(stats?.km ?? 0, profile?.verified_km ?? 0);
  const byCountry = stats?.statesByCountry ?? {};
  // Country → its states → the places you went in each. Most places first; unknown country last.
  const placesOf = (c: string) => (stats ? countryPlaces(stats, c) : { states: [], placeCount: 0 });
  const countries = [...(stats?.countryCodes ?? []), ...(byCountry[''] ? [''] : [])].sort((a, b) => {
    if (a === '' || b === '') return a === '' ? 1 : -1;
    const pa = placesOf(a), pb = placesOf(b);
    return pb.placeCount - pa.placeCount || pb.states.length - pa.states.length;
  });
  const expanded = openCountry ?? (countries.length === 1 ? countries[0] : null);
  const home = signedIn ? [profile!.home_region, profile!.home_country].filter(Boolean).join(', ') : '';

  const share = () => {
    const trips = stats?.trips ?? 0;
    const countries = stats?.countryCodes.length ?? 0;
    const who = signedIn ? `${displayName(profile)}${profile!.username ? ` (@${profile!.username})` : ''}` : 'Me';
    Share.share({
      message: `${who} on Wayfare: ${trips} ${trips === 1 ? 'journey' : 'journeys'}, ${countries} ${countries === 1 ? 'country' : 'countries'}, ${formatKm(km)} travelled.`,
    }).catch(() => undefined);
  };

  return (
    <Screen refreshing={false} onRefresh={() => { refreshProfile(); load(); }} padded={false} bottomSpace={TAB_BAR_SPACE}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
        {/* Who you are: photo and name, one quiet line of handle and home, then the bio. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }} />
          <IconButton icon="cog-outline" onPress={() => router.push('/settings')} accessibilityLabel="Settings" style={{ margin: 0 }} />
        </View>
        <View style={{ alignItems: 'center', marginTop: -8 }}>
          {signedIn ? (
            <Avatar id={profile!.id} name={displayName(profile)} path={profile!.avatar_path} size={88} />
          ) : (
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="account-outline" size={42} color={colors.muted} />
            </View>
          )}
          <Text variant="headlineSmall" style={{ fontWeight: '900', marginTop: 10, textAlign: 'center' }} numberOfLines={1}>
            {signedIn ? displayName(profile) : 'Your travels'}
          </Text>
          {signedIn && (profile!.username || home) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              {profile!.username ? <Text style={{ color: colors.muted }}>@{profile!.username}</Text> : null}
              {profile!.username && home ? <Text style={{ color: colors.subtle }}>·</Text> : null}
              {home ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Icon name="map-marker-outline" size={14} color={colors.muted} />
                  <Text style={{ color: colors.muted }} numberOfLines={1}>
                    {home}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {signedIn && profile!.bio ? (
            <Text style={{ marginTop: 8, lineHeight: 21, textAlign: 'center', color: colors.onSurfaceVariant, paddingHorizontal: 12 }} numberOfLines={3}>
              {profile!.bio}
            </Text>
          ) : null}
        </View>
        {signedIn ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Button mode="outlined" icon="pencil-outline" onPress={() => router.push('/profile/edit')} style={{ flex: 1 }}>
              Edit profile
            </Button>
            <Button mode="outlined" icon="share-variant-outline" onPress={share} style={{ flex: 1 }}>
              Share
            </Button>
          </View>
        ) : (
          <>
            <Text style={{ color: colors.muted, marginTop: 12, lineHeight: 20, textAlign: 'center' }}>Create a free account to back up your journal and pick a username.</Text>
            <Button mode="contained" onPress={() => router.push('/register')} style={{ marginTop: 12 }}>
              Create account
            </Button>
          </>
        )}

        {/* The three numbers that matter */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          <Stat value={String(stats?.trips ?? 0)} label={(stats?.trips ?? 0) === 1 ? 'Journey' : 'Journeys'} />
          <Stat value={String(stats?.countryCodes.length ?? 0)} label={(stats?.countryCodes.length ?? 0) === 1 ? 'Country' : 'Countries'} />
          <Stat value={formatKm(km)} label="Travelled" />
        </View>

        <YearTile year={year} />

        <Tile title="Places visited">
          {countries.length ? (
            // One card per country (flag, name, how many places); tap to see its states. A fixed box
            // that scrolls inside, so a hundred countries don't stretch the page.
            <ScrollView style={{ maxHeight: 316 }} contentContainerStyle={{ gap: 8 }} nestedScrollEnabled showsVerticalScrollIndicator={countries.length > 4}>
              {countries.map(c => {
                const { states, placeCount } = placesOf(c);
                const open = expanded === c;
                return (
                  <View key={c || 'other'} style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
                    <Pressable
                      onPress={() => setOpenCountry(open ? '__none__' : c)}
                      disabled={!states.length}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
                    >
                      <Text style={{ fontSize: 26 }}>{c ? flagEmoji(c) : '🌍'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
                          {c ? countryName(c) : 'Other places'}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{countrySummary(c, states.length, placeCount)}</Text>
                      </View>
                      {states.length ? <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} /> : null}
                    </Pressable>
                    {open && states.length ? (
                      // Each state with the places you went there, as plain lines.
                      <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
                        {states.map(st => (
                          <View key={st.name} style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ width: 3, borderRadius: 2, backgroundColor: colors.primaryContainer }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontWeight: '700' }}>{st.name}</Text>
                              {st.places.length ? (
                                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 1 }}>{st.places.join(' · ')}</Text>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={{ color: colors.muted, lineHeight: 20 }}>Pick a destination when you start a journey, and the places you travel to collect here.</Text>
          )}
        </Tile>

        <Tile
          title="Badges"
          action={<Pill icon="medal-outline" label={`See all ${allBadges}`} onPress={() => router.push('/badges')} />}
        >
          {earned.length || memberNo ? (
            // Two rows at a glance; more badges scroll inside the box.
            <ScrollView style={{ maxHeight: 232 }} nestedScrollEnabled showsVerticalScrollIndicator={earned.length + (memberNo ? 1 : 0) > 8}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
              {memberNo ? (
                <View style={{ width: '25%', alignItems: 'center' }} accessible accessibilityLabel={`Member number ${memberNo}`}>
                  <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: memberNo > 9999 ? 12 : memberNo > 999 ? 14 : 17 }} numberOfLines={1}>
                      #{memberNo}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }} numberOfLines={2}>
                    Member
                  </Text>
                </View>
              ) : null}
              {earned.map(b => (
                <View key={b.id} style={{ width: '25%', alignItems: 'center' }} accessible accessibilityLabel={b.title}>
                  <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: b.color, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={b.icon} size={26} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }} numberOfLines={2}>
                    {b.title}
                  </Text>
                </View>
              ))}
            </View>
            </ScrollView>
          ) : (
            <Text style={{ color: colors.muted }}>Your first badge is one journey away.</Text>
          )}
        </Tile>
        <View style={{ height: 16 }} />
      </View>
    </Screen>
  );
}
