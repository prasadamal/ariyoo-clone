import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, TextInput } from 'react-native-paper';
import { api, errorMessage } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { hashtags } from '../../src/lib/validation';
import { pushPermission, registerForPush } from '../../src/notifications';
import { radius, space, type, useTokens } from '../../src/design/tokens';
import { Card, Notice } from '../../src/design/ui';

const EXAMPLES = [
  'Best Kerala sadya in #kochi this weekend?',
  'Quiet beaches near Palolem in December? #goa',
  'Is the Munnar road safe in monsoon? #munnar',
];

export default function HomeTab() {
  const { user } = useAuth();
  const { c } = useTokens();
  const [message, setMessage] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get<{ tagName: string }[]>('/api/Tags/getAll')
      .then(res => { if (!cancelled) setTags(res.data.map(t => t.tagName)); })
      // Topic suggestions are a convenience; asking works without them.
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // What the person is typing after the last "#", used to suggest existing topics.
  const hashIndex = message.lastIndexOf('#');
  const partial = hashIndex >= 0 ? message.slice(hashIndex + 1) : '';
  const typing = hashIndex >= 0 && !/\s/.test(partial) ? partial.toLowerCase() : '';
  const typed = hashtags(message);
  const suggestions = typing
    ? tags.filter(t => t.toLowerCase().includes(typing) && !selectedTags.includes(t) && t.toLowerCase() !== typing).slice(0, 6)
    : [];
  const popular = !typing ? tags.filter(t => !selectedTags.includes(t) && !typed.includes(t.toLowerCase())).slice(0, 8) : [];

  const selectTag = (t: string) => {
    if (typing) setMessage(`${message.slice(0, hashIndex)}`.trimEnd() + ' ');
    if (!selectedTags.includes(t)) setSelectedTags([...selectedTags, t]);
  };

  const ask = async () => {
    if (!user || loading || !message.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    try {
      const allTags = [...new Set([...selectedTags.map(t => t.toLowerCase()), ...typed])].slice(0, 20);
      const res = await api.post<{ sessionId: number }>('/api/Message/postQuestion', {
        message: message.trim(),
        tag: allTags.map(t => ({ tagName: t })),
      });
      setMessage('');
      setSelectedTags([]);
      // The first question is the moment a reply alert is obviously useful, so ask then, once.
      if ((await pushPermission()) === 'undetermined') void registerForPush(true);
      router.push({ pathname: '/chat/[sessionId]', params: { sessionId: String(res.data.sessionId) } });
    } catch (e: unknown) {
      setError(errorMessage(e, 'Could not send your question. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.fullName?.split(' ')[0];
  const topicChip = (t: string, selected: boolean, onPress: () => void) => (
    <Pressable key={t} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
      accessibilityLabel={selected ? `Remove topic ${t}` : `Add topic ${t}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1,
        borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : c.surface, opacity: pressed ? 0.8 : 1 })}>
      <RNText style={{ color: selected ? c.onAccentSoft : c.text, fontWeight: '600', fontSize: 14 }}>#{t}</RNText>
      {selected ? <MaterialCommunityIcons name="close" size={14} color={c.onAccentSoft} /> : null}
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        <RNText style={[type.small, { color: c.textMuted, fontWeight: '600' }]}>{firstName ? `Hi ${firstName}` : 'Hi there'}</RNText>
        <RNText accessibilityRole="header" style={[type.title, { color: c.text, marginTop: 2, marginBottom: space.xl }]}>What do you want to know?</RNText>
        <Card style={{ padding: space.md }}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Ask about a place, a route, food, safety…"
            mode="flat"
            multiline
            maxLength={10000}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            accessibilityLabel="Your question"
            style={{ minHeight: 120, backgroundColor: 'transparent', fontSize: 17 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm, marginTop: space.xs }}>
            <RNText style={[type.small, { color: c.textFaint }]}>Tip: add #places so the right local sees it</RNText>
          </View>
        </Card>
        {!message.trim() ? (
          <View style={{ marginTop: space.lg }}>
            <RNText style={[type.caption, { color: c.textFaint, textTransform: 'uppercase', marginBottom: space.sm }]}>Try asking</RNText>
            {EXAMPLES.map(example => (
              <Pressable key={example} onPress={() => setMessage(example)} accessibilityRole="button" accessibilityLabel={`Use example: ${example}`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={c.expert} />
                <RNText style={[type.small, { color: c.textMuted, flex: 1 }]}>{example}</RNText>
              </Pressable>
            ))}
          </View>
        ) : null}
        {selectedTags.length > 0 || suggestions.length > 0 || popular.length > 0 ? (
          <View style={{ marginTop: space.lg }}>
            <RNText style={[type.caption, { color: c.textFaint, textTransform: 'uppercase', marginBottom: space.sm }]}>
              {suggestions.length ? 'Matching topics' : 'Topics locals follow'}
            </RNText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {selectedTags.map(t => topicChip(t, true, () => setSelectedTags(selectedTags.filter(x => x !== t))))}
              {(suggestions.length ? suggestions : popular).map(t => topicChip(t, false, () => selectTag(t)))}
            </View>
          </View>
        ) : null}
        <View style={{ marginTop: space.xl }}>
          {error ? <Notice text={error} /> : null}
          <Button mode="contained" icon="send" onPress={ask} loading={loading} disabled={loading || !message.trim()}
            contentStyle={{ height: 52, flexDirection: 'row-reverse' }} labelStyle={{ fontSize: 16, fontWeight: '700' }} style={{ borderRadius: radius.md }}>
            Ask the locals
          </Button>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xl, alignItems: 'flex-start' }}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color={c.textFaint} style={{ marginTop: 1 }} />
          <RNText style={[type.small, { color: c.textFaint, flex: 1 }]}>
            Answers come from members, not professionals. Never share passwords, payment details or anything you would not tell a stranger.
          </RNText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
