import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, SectionList, Text as RNText, View } from 'react-native';
import { Button } from 'react-native-paper';
import { radius, space, type, useTokens } from '../../src/design/tokens';
import { Avatar, Card, EmptyState, Notice, Pill } from '../../src/design/ui';
import { api, errorCode, errorMessage } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { mergeSessions, sessionSubtitle, type SessionRow } from '../../src/lib/sessionList';

type OpenQuestion = { sessionId: number; title: string; askedBy: string; createdAt: string };
type Item = { kind: 'open'; row: OpenQuestion } | { kind: 'chat'; row: SessionRow };

const openChat = (sessionId: number) => router.push({ pathname: '/chat/[sessionId]', params: { sessionId: String(sessionId) } });

export default function SessionsTab() {
  const { user } = useAuth();
  const { c } = useTokens();
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

  const status = (row: SessionRow): { label: string; tone: 'accent' | 'expert' | 'neutral' } => {
    if (row.resolved) return row.helpful ? { label: 'Helped', tone: 'accent' } : { label: row.waiting ? 'Withdrawn' : 'Answered', tone: 'neutral' };
    if (!row.active) return { label: 'Closed', tone: 'neutral' };
    if (row.waiting) return { label: 'Waiting', tone: 'expert' };
    return row.role === 'solver' ? { label: 'Answering', tone: 'expert' } : { label: 'Active', tone: 'accent' };
  };
  const when = (iso?: string) => {
    if (!iso) return '';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
    return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={item => `${item.kind}-${item.row.sessionId}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl, flexGrow: 1 }}
        ListHeaderComponent={
          <>
            {error ? <Notice text={error} /> : null}
            <Card onPress={() => router.push('/library')} accessibilityLabel="Your library: search your conversations and saved answers" style={{ marginBottom: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <RNText style={{ fontSize: 18 }} accessibilityElementsHidden importantForAccessibility="no">📚</RNText>
                </View>
                <View style={{ flex: 1 }}>
                  <RNText style={[type.bodyStrong, { color: c.text }]}>Your library</RNText>
                  <RNText style={[type.small, { color: c.textMuted }]}>Search past answers and see what you saved</RNText>
                </View>
                <RNText style={[type.heading, { color: c.textFaint }]} accessibilityElementsHidden importantForAccessibility="no">›</RNText>
              </View>
            </Card>
          </>
        }
        renderSectionHeader={({ section }) => (
          <RNText style={[type.caption, { color: c.textFaint, textTransform: 'uppercase', marginTop: space.md, marginBottom: space.sm }]}>{section.title}</RNText>
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListEmptyComponent={
          <EmptyState
            icon="💬"
            title="No conversations yet"
            body={user?.isSolver
              ? 'New questions on your topics will appear here. Pull down to refresh.'
              : 'Ask a question and a local will reply here, usually within the hour.'}
            action={user?.isSolver ? undefined : <Button mode="contained" onPress={() => router.navigate('/(tabs)/home')} style={{ borderRadius: radius.md }}>Ask a question</Button>}
          />
        }
        renderItem={({ item }) =>
          item.kind === 'open' ? (
            <Card style={{ borderColor: c.expert, backgroundColor: c.expertSoft }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Avatar name={item.row.askedBy} size={40} />
                <View style={{ flex: 1 }}>
                  <RNText style={[type.bodyStrong, { color: c.text }]} numberOfLines={3}>{item.row.title}</RNText>
                  <RNText style={[type.small, { color: c.onExpertSoft, marginTop: 2 }]}>{item.row.askedBy} · {when(item.row.createdAt)}</RNText>
                </View>
              </View>
              <Button mode="contained" buttonColor={c.expert} textColor={c.onExpert} compact style={{ alignSelf: 'flex-start', marginTop: space.md, borderRadius: radius.sm }}
                loading={claiming === item.row.sessionId} disabled={claiming !== null} onPress={() => claim(item.row.sessionId)}
                accessibilityLabel={`Answer: ${item.row.title}`}>
                Answer this
              </Button>
            </Card>
          ) : (
            <Card onPress={() => openChat(item.row.sessionId)} accessibilityLabel={`${item.row.title}. ${sessionSubtitle(item.row)}`}>
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Avatar name={item.row.peerName ?? (item.row.waiting ? '?' : item.row.title)} size={44} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <RNText style={[type.bodyStrong, { color: c.text, flex: 1 }]} numberOfLines={2}>{item.row.title}</RNText>
                    <RNText style={[type.small, { color: c.textFaint }]}>{when(item.row.updatedAt)}</RNText>
                  </View>
                  <RNText style={[type.small, { color: c.textMuted, marginTop: 2 }]} numberOfLines={1}>{sessionSubtitle(item.row)}</RNText>
                  <View style={{ marginTop: space.sm }}><Pill {...status(item.row)} /></View>
                </View>
              </View>
            </Card>
          )
        }
      />
    </View>
  );
}
