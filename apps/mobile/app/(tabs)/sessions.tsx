import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, SectionList, TouchableOpacity, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { api, errorCode, errorMessage } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { mergeSessions, sessionSubtitle, type SessionRow } from '../../src/lib/sessionList';

type OpenQuestion = { sessionId: number; title: string; askedBy: string; createdAt: string };
type Item = { kind: 'open'; row: OpenQuestion } | { kind: 'chat'; row: SessionRow };

const openChat = (sessionId: number) => router.push({ pathname: '/chat/[sessionId]', params: { sessionId: String(sessionId) } });

export default function SessionsTab() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [queue, setQueue] = useState<OpenQuestion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState<number | null>(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    if (!user) return;
    const id = ++request.current;
    try {
      const empty = { data: [] as never[] };
      const [seeker, solver, open] = await Promise.all([
        api.get<SessionRow[]>(`/api/Message/getallsessionsseeker/${user.userId}`),
        user.isSolver ? api.get<SessionRow[]>(`/api/Message/getallsessionssolver/${user.userId}`) : empty,
        user.isSolver ? api.get<OpenQuestion[]>('/api/Message/openQuestions') : empty,
      ]);
      // A slower, older request must not overwrite a newer one (or another account's list).
      if (id !== request.current) return;
      setSessions(mergeSessions(seeker.data, solver.data));
      setQueue(open.data);
      setError('');
    } catch (e: unknown) {
      if (id === request.current) setError(errorMessage(e, 'Could not load your conversations. Pull down to try again.'));
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); return () => { request.current++; }; }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const claim = async (sessionId: number) => {
    if (claiming !== null) return;
    setClaiming(sessionId);
    try {
      await api.post(`/api/Message/claim/${sessionId}`);
      setQueue(q => q.filter(x => x.sessionId !== sessionId));
      openChat(sessionId);
    } catch (e: unknown) {
      setError(errorCode(e) === 'ALREADY_CLAIMED' ? 'Another expert just picked that one up.' : errorMessage(e, 'Could not open that question.'));
      void load();
    } finally {
      setClaiming(null);
    }
  };

  const sections: { title: string; data: Item[] }[] = [];
  if (queue.length) sections.push({ title: 'Open questions you can answer', data: queue.map(row => ({ kind: 'open' as const, row })) });
  if (sessions.length) sections.push({ title: 'Your conversations', data: sessions.map(row => ({ kind: 'chat' as const, row })) });

  return (
    <View style={{ flex: 1 }}>
      {error ? <Text accessibilityRole="alert" style={{ color: '#f87171', padding: 16 }}>{error}</Text> : null}
      <SectionList
        sections={sections}
        keyExtractor={item => `${item.kind}-${item.row.sessionId}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={{ color: '#94a3b8', fontSize: 12, letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
            {section.title.toUpperCase()}
          </Text>
        )}
        ListEmptyComponent={
          <View style={{ padding: 24 }}>
            <Text style={{ color: '#94a3b8' }}>
              {user?.isSolver
                ? 'No conversations yet. New questions on your topics will appear here.'
                : 'No conversations yet. Ask a question from the Ask tab.'}
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'open' ? (
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium" numberOfLines={2}>{item.row.title}</Text>
                <Text style={{ color: '#94a3b8', marginTop: 4 }}>Asked by {item.row.askedBy}</Text>
              </View>
              <Button mode="contained-tonal" compact loading={claiming === item.row.sessionId} disabled={claiming !== null} onPress={() => claim(item.row.sessionId)}>
                Answer
              </Button>
            </View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => openChat(item.row.sessionId)}
              style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' }}
            >
              <Text variant="titleMedium" numberOfLines={2}>{item.row.title}</Text>
              <Text style={{ color: '#94a3b8', marginTop: 4 }}>{sessionSubtitle(item.row)}</Text>
            </TouchableOpacity>
          )
        }
      />
    </View>
  );
}
