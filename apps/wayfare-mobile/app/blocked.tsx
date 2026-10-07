import { useCallback, useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import { ActivityIndicator, Button } from 'react-native-paper';
import { UserRow } from '../src/components/UserRow';
import { useToast } from '../src/context/ToastContext';
import { listBlocked, unblock } from '../src/social/profiles';
import type { TravellerSummary } from '../src/social/types';
import { useAppTheme } from '../src/theme';
import { EmptyState } from '../src/ui/EmptyState';

export default function BlockedScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [rows, setRows] = useState<TravellerSummary[] | null>(null);
  const load = useCallback(async () => setRows(await listBlocked().catch(() => [])), []);
  useEffect(() => {
    load();
  }, [load]);
  if (rows === null) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
      data={rows}
      keyExtractor={r => r.id}
      ListEmptyComponent={<EmptyState icon="account-cancel-outline" title="Nobody blocked" body="Blocked travellers cannot see your profile, posts or message you." />}
      renderItem={({ item }) => (
        <UserRow
          id={item.id}
          username={item.username}
          name={item.display_name}
          avatarPath={item.avatar_path}
          onPress={() => undefined}
          right={
            <Button
              compact
              mode="outlined"
              onPress={async () => {
                await unblock(item.id);
                toast('Unblocked');
                load();
              }}
            >
              Unblock
            </Button>
          }
        />
      )}
    />
  );
}
