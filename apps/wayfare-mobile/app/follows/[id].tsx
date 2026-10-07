import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { FollowButton } from '../../src/components/FollowButton';
import { UserRow } from '../../src/components/UserRow';
import { useAuth } from '../../src/context/AuthContext';
import { listFollows } from '../../src/social/profiles';
import type { TravellerSummary } from '../../src/social/types';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';

export default function FollowsScreen() {
  const { id, dir } = useLocalSearchParams<{ id: string; dir?: string }>();
  const direction = dir === 'following' ? 'following' : 'followers';
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [rows, setRows] = useState<(TravellerSummary & { followed_at: string })[] | null>(null);

  const load = useCallback(async () => {
    setRows(await listFollows(String(id), direction).catch(() => []));
  }, [id, direction]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ title: direction === 'following' ? 'Following' : 'Followers' }} />
      {rows === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 16 }}
          data={rows}
          keyExtractor={r => r.id}
          ListEmptyComponent={<EmptyState icon="account-multiple-outline" title={direction === 'following' ? 'Not following anyone yet' : 'No followers yet'} />}
          renderItem={({ item }) => (
            <UserRow
              id={item.id}
              username={item.username}
              name={item.display_name}
              avatarPath={item.avatar_path}
              tier={item.tier}
              right={item.id !== user?.id ? <FollowButton userId={item.id} following={!!item.followed_by_me} /> : undefined}
            />
          )}
        />
      )}
    </>
  );
}
