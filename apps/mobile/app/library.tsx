import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { IconButton, TextInput } from 'react-native-paper';
import { errorCode, errorMessage } from '../src/api/client';
import { useAuth } from '../src/context/AuthContext';
import { radius, space, type, useTokens } from '../src/design/tokens';
import { Card, EmptyState, Notice, PageHeader, SectionLabel } from '../src/design/ui';
import { loadSaved, searchLibrary, toggleSaved, useSaved, type LibraryResults, type SavedAnswer } from '../src/lib/savedAnswers';

const openChat = (sessionId: number) => router.push({ pathname: '/chat/[sessionId]', params: { sessionId: String(sessionId) } });
const day = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/** Your own answer library: search everything you asked and answered, and the answers you kept. */
export default function LibraryScreen() {
  const { user } = useAuth();
  const { c } = useTokens();
  const saved = useSaved();
  const [query, setQuery] = useState('');
  const [list, setList] = useState<SavedAnswer[] | null>(null);
  const [results, setResults] = useState<LibraryResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const searchRequest = useRef(0);
  const trimmed = query.trim();
  const searchMode = trimmed.length >= 2;

  const owner = user?.userId;
  const reload = useCallback(async () => {
    if (!owner) return;
    const id = ++request.current;
    try {
      const rows = await loadSaved(owner);
      if (id === request.current) { setList(rows); setError(''); }
    } catch (e) {
      if (id === request.current) setError(errorMessage(e, 'Could not load your saved answers. Pull down or try again.'));
    }
  }, [owner]);

  useFocusEffect(useCallback(() => { void reload(); return () => { request.current++; }; }, [reload]));

  // Only the newest search may fill the screen; typing quickly sends one request per pause.
  useEffect(() => {
    const id = ++searchRequest.current;
    if (!searchMode) { setResults(null); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchLibrary(trimmed);
        if (id === searchRequest.current) { setResults(data); setError(''); }
      } catch (e) {
        if (id === searchRequest.current) setError(errorCode(e) === 'QUERY_TOO_SHORT' ? '' : errorMessage(e, 'Search failed. Check your connection.'));
      } finally {
        if (id === searchRequest.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [trimmed, searchMode]);

  const toggle = (messageId: number) =>
    toggleSaved(messageId).catch(e =>
      setError(errorCode(e) === 'SAVED_FULL' ? errorMessage(e, 'Your saved answers are full.') : errorMessage(e, 'Could not update. Try again.'))
    );

  // A plain function, not a component, so rows don't remount on every render.
  const bookmark = (messageId: number, label: string) => {
    const on = saved.ids.has(messageId);
    return (
      <IconButton
        icon={on ? 'bookmark' : 'bookmark-outline'}
        iconColor={on ? c.accent : c.textMuted}
        size={22}
        disabled={saved.pending.has(messageId)}
        onPress={() => void toggle(messageId)}
        accessibilityLabel={on ? `Remove from saved: ${label}` : `Save: ${label}`}
        style={{ margin: 0 }}
      />
    );
  };

  const visibleSaved = (list ?? []).filter(s => saved.ids.has(s.messageId) || saved.pending.has(s.messageId));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
      <PageHeader title="Your library" subtitle="Search everything you've asked and answered, and keep the answers worth coming back to." />
      <TextInput
        mode="outlined"
        value={query}
        onChangeText={setQuery}
        placeholder="Search: biryani, visa, Fort Kochi…"
        left={<TextInput.Icon icon="magnify" />}
        right={query ? <TextInput.Icon icon="close" onPress={() => setQuery('')} accessibilityLabel="Clear search" /> : undefined}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search your conversations"
        outlineStyle={{ borderRadius: radius.md }}
        style={{ backgroundColor: c.surface, marginBottom: space.md }}
      />
      {error ? <Notice text={error} /> : null}

      {searchMode ? (
        searching && !results ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: space.xl }} accessibilityLabel="Searching" />
        ) : results && !results.questions.length && !results.messages.length ? (
          <EmptyState icon="🔎" title="Nothing found" body={`No question or message of yours mentions "${trimmed}". Try another word.`} />
        ) : results ? (
          <>
            {results.questions.length ? <SectionLabel>Questions</SectionLabel> : null}
            <View style={{ gap: space.sm }}>
              {results.questions.map(q => (
                <Card key={`q${q.sessionId}`} onPress={() => openChat(q.sessionId)} accessibilityLabel={`Open: ${q.title}`}>
                  <RNText style={[type.bodyStrong, { color: c.text }]} numberOfLines={2}>{q.title}</RNText>
                  <RNText style={[type.small, { color: c.textMuted, marginTop: 2 }]}>
                    {q.role === 'seeker' ? 'You asked' : 'You answered'}{q.peerName ? ` · with ${q.peerName}` : ''} · {day(q.updatedAt)}
                  </RNText>
                </Card>
              ))}
            </View>
            {results.messages.length ? <SectionLabel>Answers and messages</SectionLabel> : null}
            <View style={{ gap: space.sm }}>
              {results.messages.map(m => (
                <Card key={`m${m.messageId}`} onPress={() => openChat(m.sessionId)} accessibilityLabel={`${m.fromMe ? 'You' : m.peerName ?? 'Someone'} wrote: ${m.snippet}. In ${m.title}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                    <View style={{ flex: 1 }}>
                      <RNText style={[type.body, { color: c.text }]}>{m.snippet}</RNText>
                      <RNText style={[type.small, { color: c.textMuted, marginTop: space.xs }]} numberOfLines={1}>
                        {m.fromMe ? 'You' : m.peerName ?? 'Expert'} · {m.title}
                      </RNText>
                    </View>
                    {bookmark(m.messageId, m.snippet)}
                  </View>
                </Card>
              ))}
            </View>
          </>
        ) : null
      ) : list === null ? (
        error ? null : <ActivityIndicator color={c.accent} style={{ marginTop: space.xl }} accessibilityLabel="Loading saved answers" />
      ) : visibleSaved.length === 0 ? (
        <EmptyState icon="📌" title="No saved answers yet" body="In any conversation, tap the bookmark on a message to keep it here. Search above works across all your conversations." />
      ) : (
        <>
          <SectionLabel>{`Saved answers · ${visibleSaved.length}`}</SectionLabel>
          <View style={{ gap: space.sm }}>
            {visibleSaved.map(s => (
              <Card key={s.messageId} style={{ paddingRight: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                  <Pressable style={{ flex: 1 }} onPress={() => openChat(s.sessionId)} accessibilityRole="button" accessibilityLabel={`Open the conversation: ${s.title}`}>
                    <View style={{ borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: space.md }}>
                      <RNText style={[type.body, { color: c.text }]} numberOfLines={8}>{s.text}</RNText>
                    </View>
                    <RNText style={[type.small, { color: c.textMuted, marginTop: space.sm }]} numberOfLines={2}>
                      {s.fromMe ? 'You' : s.peerName ?? 'Expert'} · {s.title}
                    </RNText>
                  </Pressable>
                  {bookmark(s.messageId, s.text.slice(0, 60))}
                </View>
              </Card>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
