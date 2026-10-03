import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';

export default function HomeTab() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/Tags/getAll')
      .then(res => setTags(res.data.map((t: { tagName: string }) => t.tagName)))
      .catch(() => setError('Could not load tags. Is the API running?'));
  }, []);

  const onChange = (text: string) => {
    setMessage(text);
    const hashIndex = text.lastIndexOf('#');
    if (hashIndex >= 0) {
      const q = text.slice(hashIndex + 1).split(' ')[0].toLowerCase();
      setSuggestions(q.length ? tags.filter(t => t.toLowerCase().includes(q)).slice(0, 6) : []);
    } else {
      setSuggestions([]);
    }
  };

  const selectTag = (t: string) => {
    const hashIndex = message.lastIndexOf('#');
    const before = message.slice(0, hashIndex);
    const after = message.slice(hashIndex).split(' ').slice(1).join(' ');
    setMessage(`${before}${after ? ' ' + after : ''}`.trim());
    if (!selectedTags.includes(t)) setSelectedTags([...selectedTags, t]);
    setSuggestions([]);
  };

  const ask = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/Message/postQuestion', {
        message,
        tag: selectedTags.map(t => ({ tagName: t })),
      });
      router.push({ pathname: '/chat/[sessionId]', params: { sessionId: String(res.data.sessionId) } });
      setMessage('');
      setSelectedTags([]);
    } catch (e: unknown) {
      const messageText =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not send your question. Check that the API is reachable.';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text variant="headlineSmall" style={{ marginBottom: 4 }}>Ask a question</Text>
      <Text style={{ color: '#94a3b8', marginBottom: 16 }}>Use #tags to match the right expert.</Text>
      <TextInput
        value={message}
        onChangeText={onChange}
        placeholder="e.g. Best beaches in Goa #goa #beaches"
        mode="outlined"
        multiline
        style={{ marginBottom: 8, minHeight: 120 }}
      />
      {suggestions.length > 0 && (
        <FlatList
          data={suggestions}
          keyExtractor={item => item}
          style={{ maxHeight: 160, marginBottom: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => selectTag(item)} style={{ paddingVertical: 8 }}>
              <Text>#{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {selectedTags.map(t => (
          <Chip key={t} onClose={() => setSelectedTags(selectedTags.filter(x => x !== t))}>#{t}</Chip>
        ))}
      </View>
      {error ? <Text style={{ color: '#f87171', marginBottom: 12 }}>{error}</Text> : null}
      <Button mode="contained" onPress={ask} loading={loading} disabled={!message.trim()}>
        Send to experts
      </Button>
    </View>
  );
}
