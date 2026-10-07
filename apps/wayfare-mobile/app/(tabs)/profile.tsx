import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { PostCard } from '../../src/components/PostCard';
import { ProfileHeader } from '../../src/components/ProfileHeader';
import { useAuth, useCanConnect } from '../../src/context/AuthContext';
import { computeBadges, sortBadges } from '../../src/lib/badges';
import { displayName, formatKm } from '../../src/lib/format';
import { useTravelStats } from '../../src/lib/useTravelStats';
import { useFeed } from '../../src/social/useFeed';
import { useAppTheme } from '../../src/theme';
import { Hero } from '../../src/ui/Hero';
import { Icon } from '../../src/ui/Icon';
import { Screen } from '../../src/ui/Screen';
import { SectionHeader } from '../../src/ui/SectionHeader';
import { StatRow, StatTile } from '../../src/ui/StatTile';

function Row({ icon, label, onPress, tint }: { icon: string; label: string; onPress: () => void; tint?: string }) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, opacity: pressed ? 0.7 : 1, borderBottomWidth: 1, borderBottomColor: colors.border })} accessibilityRole="button">
      <Icon name={icon} size={22} color={tint ?? colors.onSurfaceVariant} />
      <Text style={{ flex: 1, fontWeight: '600' }}>{label}</Text>
      <Icon name="chevron-right" size={20} color={colors.subtle} />
    </Pressable>
  );
}

export default function ProfileTab() {
  const { colors } = useAppTheme();
  const { user, profile, refreshProfile } = useAuth();
  const canConnect = useCanConnect();
  const stats = useTravelStats();
  const badges = useMemo(() => (stats ? sortBadges(computeBadges(stats)) : []), [stats]);
  const earned = badges.filter(b => b.earned);
  const myPosts = useFeed('user', { userId: user?.id ?? null, enabled: canConnect && !!user?.id });
  const year = new Date().getFullYear();

  const shareProfile = () => {
    if (!profile?.username) return;
    Share.share({ message: `Follow my journeys on Wayfare: @${profile.username}\nwayfare://user/@${profile.username}` });
  };

  return (
    <Screen refreshing={false} onRefresh={() => { refreshProfile(); myPosts.refresh(); }}>
      {canConnect && profile ? (
        <ProfileHeader
          id={profile.id}
          name={displayName(profile)}
          username={profile.username}
          avatarPath={profile.avatar_path}
          bio={profile.bio}
          homeRegion={profile.home_region}
          homeCountry={profile.home_country}
          styles={profile.travel_styles}
          languages={profile.languages}
          tier={profile.tier}
          verifiedKm={profile.verified_km}
          maxAltitudeM={profile.max_altitude_m}
          trips={Math.max(profile.trips_count, stats?.trips ?? 0)}
          followers={profile.followers_count}
          following={profile.following_count}
          posts={profile.posts_count}
          showTierProgress
          actions={
            <>
              <Button mode="contained-tonal" icon="pencil-outline" onPress={() => router.push('/profile/edit')} style={{ flex: 1 }}>
                Edit profile
              </Button>
              <Button mode="outlined" icon="share-variant" onPress={shareProfile}>
                Share
              </Button>
            </>
          }
        />
      ) : (
        <Hero>
          <Text variant="headlineSmall" style={{ color: '#fff', fontWeight: '900' }}>
            Your travel life
          </Text>
          <Text style={{ color: '#ffffffd9', marginTop: 4, lineHeight: 20 }}>
            Create a free account to back up your journal, earn a verified traveller tier and meet people heading your way.
          </Text>
          <Button mode="contained" buttonColor="#fff" textColor={colors.heroEnd} style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => router.push('/register')}>
            Create account
          </Button>
        </Hero>
      )}

      {stats ? (
        <>
          <SectionHeader title="On this device" />
          <StatRow>
            <StatTile icon="map-outline" value={String(stats.trips)} label="Journeys" />
            <StatTile icon="feather" value={String(stats.entries)} label="Moments" tint={colors.tertiary} />
            <StatTile icon="map-marker-path" value={formatKm(stats.km)} label="Recorded" tint={colors.secondary} />
          </StatRow>
        </>
      ) : null}

      <Pressable onPress={() => router.push('/wrapped')} accessibilityRole="button" style={{ marginTop: 16 }}>
        <Hero variant="violet">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="party-popper" size={30} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>Your {year} in travel</Text>
              <Text style={{ color: '#ffffffd9' }}>Kilometres, peaks, moods and your traveller persona</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#fff" />
          </View>
        </Hero>
      </Pressable>

      <SectionHeader title="Badges" subtitle={`${earned.length} of ${badges.length} earned`} action="See all" onAction={() => router.push('/badges')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {badges.slice(0, 8).map(b => (
          <View key={b.id} style={{ width: '22%', alignItems: 'center', opacity: b.earned ? 1 : 0.4 }} accessibilityLabel={`${b.title}${b.earned ? ', earned' : ''}`}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: b.earned ? b.color : colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={b.icon} size={26} color={b.earned ? '#fff' : colors.muted} />
            </View>
            <Text style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }} numberOfLines={2}>
              {b.title}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Tools" />
      <Row icon="shield-alert-outline" label="Safety center & SOS" onPress={() => router.push('/safety')} tint={colors.danger} />
      <Row icon="swap-horizontal" label="Currency converter" onPress={() => router.push('/tools/currency')} />
      {canConnect ? <Row icon="account-search-outline" label="Find travellers" onPress={() => router.push('/search')} /> : null}
      <Row icon="cog-outline" label="Settings & privacy" onPress={() => router.push('/settings')} />

      {canConnect && myPosts.posts.length ? (
        <>
          <SectionHeader title="Your posts" />
          {myPosts.posts.slice(0, 5).map(p => (
            <PostCard key={p.id} post={p} onChanged={myPosts.update} onDeleted={myPosts.remove} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
