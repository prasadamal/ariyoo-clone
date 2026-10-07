import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { FAB, Text } from 'react-native-paper';
import { BoardCard } from '../../components/BoardCard';
import { placeLabel } from '../../lib/places';
import { BOARD_KINDS, boardPage } from '../../social/board';
import type { BoardKind, BoardPost } from '../../social/types';
import { useAppTheme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { Notice } from '../../ui/Notice';
import { Pill } from '../../ui/Pill';

export function BoardSection({ initialPlaceKey }: { initialPlaceKey?: string | null }) {
  const { colors } = useAppTheme();
  const [kind, setKind] = useState<BoardKind | null>(null);
  const [mine, setMine] = useState(false);
  const [placeKey, setPlaceKey] = useState<string | null>(initialPlaceKey ?? null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPlaceKey(initialPlaceKey ?? null), [initialPlaceKey]);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      try {
        const before = reset || !posts.length ? null : posts[posts.length - 1].created_at;
        const page = await boardPage({ kind, placeKey, mine, before });
        setPosts(reset ? page : [...posts, ...page]);
        setDone(page.length < 20);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the board');
      } finally {
        setLoading(false);
      }
    },
    [kind, placeKey, mine, posts]
  );

  useEffect(() => {
    load(true);
  }, [kind, placeKey, mine]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 100 }}
        refreshing={loading && !posts.length}
        onRefresh={() => load(true)}
        onEndReached={() => !done && !loading && posts.length && load(false)}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ marginBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pill label="All" selected={!kind && !mine} onPress={() => { setKind(null); setMine(false); }} />
              {BOARD_KINDS.map(k => (
                <Pill key={k.value} icon={k.icon} label={k.label} selected={kind === k.value} onPress={() => { setKind(kind === k.value ? null : k.value); setMine(false); }} />
              ))}
              <Pill icon="account-outline" label="Mine & requested" selected={mine} onPress={() => setMine(!mine)} />
            </ScrollView>
            {placeKey ? (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Pill icon="close" label={`Only ${placeLabel(placeKey)}`} selected onPress={() => setPlaceKey(null)} />
              </View>
            ) : null}
            {error ? <Notice tone="error" text={error} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ margin: 24 }} color={colors.primary} />
          ) : (
            <EmptyState
              icon="bulletin-board"
              title={mine ? 'Nothing here yet' : 'Be the first on the board'}
              body="Looking for a trek partner, a shared jeep or someone for sunset chai? Post it — travellers heading the same way will ask to join."
              action="Post to the board"
              onAction={() => router.push({ pathname: '/board/new', params: placeKey ? { placeKey } : {} })}
            />
          )
        }
        ListFooterComponent={loading && posts.length ? <ActivityIndicator style={{ margin: 16 }} /> : null}
        renderItem={({ item }) => <BoardCard post={item} />}
      />
      <FAB
        icon="plus"
        label="Post"
        style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.tertiary }}
        color={colors.onTertiary}
        onPress={() => router.push({ pathname: '/board/new', params: placeKey ? { placeKey } : {} })}
        accessibilityLabel="Post to the travel board"
      />
    </View>
  );
}
