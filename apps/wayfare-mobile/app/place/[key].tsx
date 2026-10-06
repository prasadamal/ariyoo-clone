import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { BoardCard } from '../../src/components/BoardCard';
import { PostCard } from '../../src/components/PostCard';
import { DESTINATION_KIND_LABELS, getDestination } from '../../src/content/destinations';
import { ALTITUDE_GUIDE } from '../../src/content/safety';
import { useCanConnect } from '../../src/context/AuthContext';
import { useInbox } from '../../src/context/InboxContext';
import { useToast } from '../../src/context/ToastContext';
import { TipsSection } from '../../src/features/place/TipsSection';
import { formatMoney } from '../../src/lib/currencyMath';
import { displayName, formatDateRange, formatDay } from '../../src/lib/format';
import { MONTH_NAMES, isValidPlaceKey, placeLabel } from '../../src/lib/places';
import { fetchCurrentWeather, fetchForecast, weatherCodeIcon, weatherCodeLabel, type CurrentWeather, type ForecastDay } from '../../src/lib/weather';
import { boardPage } from '../../src/social/board';
import { joinPlaceRoom } from '../../src/social/chat';
import { travellersHeadingTo } from '../../src/social/places';
import type { BoardPost, HeadingTraveller } from '../../src/social/types';
import { useFeed } from '../../src/social/useFeed';
import { useAppTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Hero } from '../../src/ui/Hero';
import { Icon } from '../../src/ui/Icon';
import { Pill } from '../../src/ui/Pill';
import { Screen } from '../../src/ui/Screen';
import { SectionHeader } from '../../src/ui/SectionHeader';

function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Icon name={icon} size={20} color={colors.secondary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 13 }}>{label}</Text>
        <Text style={{ color: colors.onSurfaceVariant, lineHeight: 20 }}>{value}</Text>
      </View>
    </View>
  );
}

export default function PlaceScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const placeKey = String(key);
  const { colors } = useAppTheme();
  const canConnect = useCanConnect();
  const { refresh: refreshInbox } = useInbox();
  const toast = useToast();
  const d = getDestination(placeKey);
  const name = d?.name ?? placeLabel(placeKey);
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [heading, setHeading] = useState<HeadingTraveller[]>([]);
  const [board, setBoard] = useState<BoardPost[]>([]);
  const posts = useFeed('place', { placeKey, enabled: canConnect && isValidPlaceKey(placeKey) });
  const month = new Date().getMonth() + 1;

  useEffect(() => {
    if (d) {
      fetchCurrentWeather(d.lat, d.lng).then(setWeather);
      fetchForecast(d.lat, d.lng, 7).then(setForecast);
    }
    if (canConnect && isValidPlaceKey(placeKey)) {
      travellersHeadingTo(placeKey).then(setHeading).catch(() => undefined);
      boardPage({ placeKey }).then(setBoard).catch(() => undefined);
    }
  }, [placeKey, d, canConnect]);

  const joinRoom = async () => {
    try {
      const id = await joinPlaceRoom(placeKey, name);
      refreshInbox();
      router.push(`/chat/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join room');
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: name }} />
      <Hero variant="glacier">
        <Text style={{ color: '#ffffffcc', fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
          {d ? `${d.region.toUpperCase()} · ${d.country.toUpperCase()}` : 'DESTINATION'}
        </Text>
        <Text variant="headlineMedium" style={{ color: '#fff', fontWeight: '900', marginTop: 4 }}>
          {name}
        </Text>
        {d ? <Text style={{ color: '#ffffffe6', marginTop: 4, lineHeight: 21 }}>{d.tagline}</Text> : null}
        {weather ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <Icon name={weatherCodeIcon(weather.code)} size={22} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700' }}>Now: {weather.summary}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <Button mode="contained" buttonColor="#fff" textColor={colors.tealEnd} icon="map-marker-plus" onPress={() => router.push({ pathname: '/trip/new', params: { placeKey } })}>
            Plan a journey
          </Button>
          {canConnect ? (
            <Button mode="outlined" textColor="#fff" style={{ borderColor: '#ffffffaa' }} icon="forum-outline" onPress={joinRoom}>
              Room
            </Button>
          ) : null}
        </View>
      </Hero>

      {d ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {d.kinds.map(k => (
              <Pill key={k} label={DESTINATION_KIND_LABELS[k]} />
            ))}
            {d.difficulty ? <Pill icon="speedometer" label={d.difficulty} /> : null}
            {d.maxAltitudeM ? <Pill icon="image-filter-hdr" label={`${d.maxAltitudeM.toLocaleString('en-IN')} m`} /> : null}
            {d.duration ? <Pill icon="clock-outline" label={d.duration} /> : null}
            <Pill
              icon="cash"
              label={`${formatMoney(d.budgetPerDayInr[0], 'INR', { compact: true })}–${formatMoney(d.budgetPerDayInr[1], 'INR', { compact: true })}/day`}
            />
          </View>

          <SectionHeader title="When to go" subtitle={d.bestSeason} />
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {MONTH_NAMES.map((m, i) => {
              const good = d.bestMonths.includes(i + 1);
              const now = i + 1 === month;
              return (
                <View key={m} style={{ flex: 1, alignItems: 'center' }} accessibilityLabel={`${m}${good ? ', good time' : ''}`}>
                  <View style={{ height: 26, width: '100%', borderRadius: 6, backgroundColor: good ? colors.secondary : colors.surfaceVariant, borderWidth: now ? 2 : 0, borderColor: colors.primary }} />
                  <Text style={{ fontSize: 9, color: now ? colors.primary : colors.muted, marginTop: 2, fontWeight: now ? '800' : '400' }}>{m[0]}</Text>
                </View>
              );
            })}
          </View>

          {forecast.length ? (
            <>
              <SectionHeader title="Next 7 days" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {forecast.map(f => (
                  <View key={f.date} style={{ width: 74, alignItems: 'center', padding: 8, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }} accessibilityLabel={`${formatDay(f.date, { weekday: true })}: ${weatherCodeLabel(f.code)}`}>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{formatDay(f.date, { weekday: true }).split(',')[0]}</Text>
                    <Icon name={weatherCodeIcon(f.code)} size={24} color={colors.secondary} />
                    <Text style={{ fontWeight: '800' }}>{f.maxC != null ? `${Math.round(f.maxC)}°` : '—'}</Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{f.minC != null ? `${Math.round(f.minC)}°` : ''}</Text>
                    {f.precipChance ? <Text style={{ fontSize: 10, color: colors.info }}>{f.precipChance}%</Text> : null}
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}

          <SectionHeader title="Highlights" />
          {d.highlights.map(h => (
            <View key={h} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
              <Icon name="star-four-points-outline" size={16} color={colors.primary} />
              <Text style={{ flex: 1 }}>{h}</Text>
            </View>
          ))}

          <SectionHeader title="Know before you go" />
          {d.permits ? <Fact icon="card-account-details-outline" label="Permits & fees" value={d.permits} /> : null}
          <Fact icon="bus" label="Getting there" value={d.transport} />
          <Fact icon="signal-cellular-2" label="Connectivity" value={d.connectivity} />
          {d.acclimatisation ? <Fact icon="image-filter-hdr" label="Altitude" value={d.acclimatisation} /> : null}
          {d.safety ? <Fact icon="shield-alert-outline" label="Safety" value={d.safety} /> : null}
          {(d.maxAltitudeM ?? 0) >= 2500 ? (
            <Button icon="medical-bag" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => router.push('/safety')}>
              {ALTITUDE_GUIDE.rules.length} altitude rules & warning signs
            </Button>
          ) : null}
        </>
      ) : (
        <Text style={{ color: colors.muted, marginTop: 14, lineHeight: 20 }}>
          This place is not in our guide yet — but travellers can still meet, share tips and post plans for it here.
        </Text>
      )}

      {canConnect ? (
        <>
          <SectionHeader
            title={heading.length ? `${heading.length} traveller${heading.length === 1 ? '' : 's'} heading here` : 'Heading here'}
            subtitle="Next 4 months · open to meet"
          />
          {heading.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {heading.map(h => (
                <View key={h.user_id} style={{ width: 72, alignItems: 'center' }}>
                  <Avatar id={h.user_id} name={displayName(h)} path={h.avatar_path} size={56} />
                  <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', marginTop: 4 }} onPress={() => router.push(`/user/${h.user_id}`)}>
                    {displayName(h)}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 10, color: colors.muted }}>
                    {formatDateRange(h.starts_on, h.ends_on)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={{ color: colors.muted }}>Plan a journey here and switch on “open to meet” to appear for others.</Text>
          )}

          <TipsSection placeKey={placeKey} placeName={name} />

          <SectionHeader title="On the board" action="Post" onAction={() => router.push({ pathname: '/board/new', params: { placeKey } })} />
          {board.length ? board.slice(0, 3).map(b => <BoardCard key={b.id} post={b} />) : <Text style={{ color: colors.muted }}>No open plans for {name} yet.</Text>}

          <SectionHeader title="Recent moments" action="Share one" onAction={() => router.push({ pathname: '/post/new', params: { placeKey } })} />
          {posts.posts.length ? (
            posts.posts.slice(0, 5).map(p => <PostCard key={p.id} post={p} onChanged={posts.update} onDeleted={posts.remove} onBlocked={posts.removeAuthor} />)
          ) : (
            <Text style={{ color: colors.muted }}>No public posts tagged here yet.</Text>
          )}
        </>
      ) : (
        <Button mode="outlined" style={{ marginTop: 20 }} icon="account-group-outline" onPress={() => router.push('/register')}>
          Sign up to see who is heading here
        </Button>
      )}
    </Screen>
  );
}
