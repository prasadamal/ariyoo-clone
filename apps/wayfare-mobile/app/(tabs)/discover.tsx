import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { FAB, Searchbar, SegmentedButtons, Text } from 'react-native-paper';
import { DestinationCard } from '../../src/components/DestinationCard';
import { GuidelinesGate } from '../../src/components/GuidelinesGate';
import { PostCard } from '../../src/components/PostCard';
import { UserRow } from '../../src/components/UserRow';
import { FollowButton } from '../../src/components/FollowButton';
import { DESTINATION_KIND_ICONS, DESTINATION_KIND_LABELS, type DestinationKind } from '../../src/content/destinations';
import { useAuth, useCanConnect } from '../../src/context/AuthContext';
import { MONTH_NAMES, searchDestinations } from '../../src/lib/places';
import { suggestedTravellers } from '../../src/social/profiles';
import type { FeedMode, TravellerSummary } from '../../src/social/types';
import { useFeed } from '../../src/social/useFeed';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Notice } from '../../src/ui/Notice';
import { Pill } from '../../src/ui/Pill';
import { SectionHeader } from '../../src/ui/SectionHeader';

type DiscoverView = 'feed' | 'places';

function Suggestions() {
  const [people, setPeople] = useState<TravellerSummary[]>([]);
  useEffect(() => {
    suggestedTravellers(8).then(setPeople).catch(() => setPeople([]));
  }, []);
  if (!people.length) return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <SectionHeader title="Travellers like you" subtitle="Similar styles and regions" action="Search" onAction={() => router.push('/search')} style={{ marginTop: 4 }} />
      {people.slice(0, 4).map(p => (
        <UserRow
          key={p.id}
          id={p.id}
          username={p.username}
          name={p.display_name}
          avatarPath={p.avatar_path}
          tier={p.tier}
          subtitle={p.home_region ?? undefined}
          right={<FollowButton userId={p.id} following={!!p.followed_by_me} />}
        />
      ))}
    </View>
  );
}

function Feed() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const [mode, setMode] = useState<FeedMode>('following');
  const feed = useFeed(mode);
  const showSuggestions = mode === 'following' && (profile?.following_count ?? 0) < 5;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={feed.posts}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 100 }}
        onRefresh={feed.refresh}
        refreshing={feed.refreshing}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              <Pill icon="account-heart-outline" label="Following" selected={mode === 'following'} onPress={() => setMode('following')} />
              <Pill icon="fire" label="Trending" selected={mode === 'trending'} onPress={() => setMode('trending')} />
              <Pill icon="clock-outline" label="Latest" selected={mode === 'discover'} onPress={() => setMode('discover')} />
              <Pill icon="account-search-outline" label="Find travellers" onPress={() => router.push('/search')} />
            </ScrollView>
            {feed.error ? <Notice tone="error" text={feed.error} /> : null}
            {showSuggestions ? <Suggestions /> : null}
          </View>
        }
        ListEmptyComponent={
          feed.refreshing ? null : (
            <EmptyState
              icon={mode === 'following' ? 'account-heart-outline' : 'compass-outline'}
              title={mode === 'following' ? 'Your feed is quiet' : 'No posts yet'}
              body={
                mode === 'following'
                  ? 'Follow travellers to see their moments and GPS-verified journeys here — or share your own.'
                  : 'Be the first to share a moment from the road.'
              }
              action="Share a moment"
              onAction={() => router.push('/post/new')}
              secondary={mode === 'following' ? 'See trending' : undefined}
              onSecondary={mode === 'following' ? () => setMode('trending') : undefined}
            />
          )
        }
        ListFooterComponent={feed.loading ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
        renderItem={({ item }) => <PostCard post={item} onChanged={feed.update} onDeleted={feed.remove} onBlocked={feed.removeAuthor} />}
      />
      <FAB
        icon="pencil-plus"
        style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.primary }}
        color={colors.onPrimary}
        onPress={() => router.push('/post/new')}
        accessibilityLabel="Share a moment"
      />
    </View>
  );
}

function Places() {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<DestinationKind | null>(null);
  const [seasonOnly, setSeasonOnly] = useState(false);
  const month = new Date().getMonth() + 1;
  const results = useMemo(
    () => searchDestinations({ query, kind, month: seasonOnly ? month : null }),
    [query, kind, seasonOnly, month]
  );
  return (
    <FlatList
      data={results}
      keyExtractor={d => d.key}
      contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ marginBottom: 8 }}>
          <Searchbar placeholder="Search treks, cities, beaches…" value={query} onChangeText={setQuery} style={{ marginBottom: 10 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            <Pill
              icon="white-balance-sunny"
              label={`Great in ${MONTH_NAMES[month - 1]}`}
              selected={seasonOnly}
              onPress={() => setSeasonOnly(!seasonOnly)}
            />
            {(Object.keys(DESTINATION_KIND_LABELS) as DestinationKind[]).map(k => (
              <Pill key={k} icon={DESTINATION_KIND_ICONS[k]} label={DESTINATION_KIND_LABELS[k]} selected={kind === k} onPress={() => setKind(kind === k ? null : k)} />
            ))}
          </ScrollView>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
            {results.length} destination{results.length === 1 ? '' : 's'} · tap for guides, forecast, tips and who’s going
          </Text>
        </View>
      }
      ListEmptyComponent={<EmptyState compact icon="map-search-outline" title="No matches" body="Try another search, or start a journey to anywhere — custom places work too." />}
      renderItem={({ item }) => <DestinationCard d={item} inSeason={item.bestMonths.includes(month)} />}
    />
  );
}

export default function DiscoverTab() {
  const { colors } = useAppTheme();
  const canConnect = useCanConnect();
  const [view, setView] = useState<DiscoverView>(canConnect ? 'feed' : 'places');
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <SegmentedButtons
          value={view}
          onValueChange={v => setView(v as DiscoverView)}
          buttons={[
            { value: 'feed', label: 'Feed', icon: 'newspaper-variant-outline' },
            { value: 'places', label: 'Places', icon: 'map-search-outline' },
          ]}
        />
      </View>
      {view === 'feed' ? (
        <GuidelinesGate what="see journeys from travellers">
          <Feed />
        </GuidelinesGate>
      ) : (
        <Places />
      )}
    </View>
  );
}
