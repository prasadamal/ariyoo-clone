import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';

type SessionRow = { sessionId: number; title: string; active: boolean };

export default function SessionsTab() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
    const [seeker, solver] = await Promise.all([
      api.get<SessionRow[]>(`/api/Message/getallsessionsseeker/${user.userId}`),
      user.isSolver
        ? api.get<SessionRow[]>(`/api/Message/getallsessionssolver/${user.userId}`)
        : Promise.resolve({ data: [] as SessionRow[] }),
    ]);
    const merged = [...seeker.data, ...solver.data];
    const unique = merged.filter(
      (row, index) => merged.findIndex(other => other.sessionId === row.sessionId) === index
    );
    setSessions(unique);
    } catch {
      setError('Could not load conversations. Pull to retry.');
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={sessions}
        keyExtractor={item => String(item.sessionId)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />}
        ListEmptyComponent={
          <View style={{ padding: 24 }}>
            <Text style={{ color: '#94a3b8' }}>
              {error || 'No conversations yet. Ask a question from the Ask tab.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: '/chat/[sessionId]', params: { sessionId: String(item.sessionId) } })
            }
            style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' }}
          >
            <Text variant="titleMedium">{item.title}</Text>
            <Text style={{ color: '#94a3b8', marginTop: 4 }}>{item.active ? 'Active' : 'Closed'}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
