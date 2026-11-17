import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';
import { api, errorMessage } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { hashtags } from '../../src/lib/validation';
import { pushPermission, registerForPush } from '../../src/notifications';

export default function HomeTab() {
  const { user } = useAuth();
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

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={{ marginBottom: 4 }}>Ask a question</Text>
      <Text style={{ color: '#94a3b8', marginBottom: 16 }}>Add #topics so the right expert sees it.</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="e.g. Quiet beaches near Palolem in December? #goa #beaches"
        mode="outlined"
        multiline
        maxLength={10000}
        style={{ marginBottom: 8, minHeight: 120 }}
      />
      {suggestions.length > 0 || popular.length > 0 ? (
        <View style={{ marginBottom: 8 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>{suggestions.length ? 'Matching topics' : 'Topics experts follow'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(suggestions.length ? suggestions : popular).map(t => (
              <Chip key={t} compact onPress={() => selectTag(t)}>#{t}</Chip>
            ))}
          </View>
        </View>
      ) : null}
      {selectedTags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {selectedTags.map(t => (
            <Chip key={t} selected onClose={() => setSelectedTags(selectedTags.filter(x => x !== t))}>#{t}</Chip>
          ))}
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={{ color: '#f87171', marginBottom: 12 }}>{error}</Text> : null}
      <Button mode="contained" onPress={ask} loading={loading} disabled={loading || !message.trim()}>
        Send to experts
      </Button>
      <Text style={{ color: '#64748b', fontSize: 12, marginTop: 16 }}>
        Answers come from other members, not professionals. Do not share passwords, payment details or anything you would not tell a stranger.
      </Text>
    </ScrollView>
  );
}
