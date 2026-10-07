import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GuidelinesGate } from '../../src/components/GuidelinesGate';
import { useInbox } from '../../src/context/InboxContext';
import { joinByCode } from '../../src/social/chat';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';

function Joiner({ code }: { code: string }) {
  const { refresh } = useInbox();
  const { colors } = useAppTheme();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    joinByCode(code)
      .then(async id => {
        await refresh();
        router.replace(`/chat/${id}`);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'That invite code is not valid'));
  }, [code, refresh]);
  if (error) {
    return <EmptyState icon="key-remove" title="Could not join" body={error} action="Go to inbox" onAction={() => router.replace('/(tabs)/inbox')} />;
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <GuidelinesGate what="join this crew">
      <Joiner code={String(code)} />
    </GuidelinesGate>
  );
}
