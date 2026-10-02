import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import io, { Socket } from 'socket.io-client';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { getApiBaseUrl } from '../../src/config';

type ChatMessage = {
  id?: number;
  messageText?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  senderId: number;
};

export default function ChatScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const sid = Number(sessionId);
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const loadMessages = async () => {
    const res = await api.get<ChatMessage[]>(`/api/Message/getMessagesBySessionId/${sid}`);
    setMessages(res.data);
  };

  useEffect(() => {
    loadMessages();
    const socket = io(getApiBaseUrl(), { transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join', String(sid));
    socket.on('message', (m: ChatMessage & { sessionId: number }) => {
      if (Number(m.sessionId) === sid) setMessages(prev => [...prev, m]);
    });
    return () => {
      socket.disconnect();
    };
  }, [sid]);

  const send = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    try {
      await api.post('/api/Message/postMessage', {
        senderId: user.userId,
        messageText: text.trim(),
        sessionId: sid,
      });
      setText('');
      await loadMessages();
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const form = new FormData();
    form.append('senderId', String(user.userId));
    form.append('sessionId', String(sid));
    form.append('image', {
      uri: asset.uri,
      name: 'upload.jpg',
      type: asset.mimeType || 'image/jpeg',
    } as unknown as Blob);
    await api.post('/api/Message/uploadImage', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await loadMessages();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        style={{ flex: 1, padding: 12 }}
        data={messages}
        keyExtractor={(item, idx) => String(item.id ?? idx)}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.userId;
          return (
            <View
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                backgroundColor: mine ? '#1d4ed8' : '#334155',
                padding: 10,
                borderRadius: 12,
                marginBottom: 8,
                maxWidth: '85%',
              }}
            >
              {item.messageText ? <Text style={{ color: '#f8fafc' }}>{item.messageText}</Text> : null}
              {item.imageUrl ? (
                <Text style={{ color: '#bae6fd', marginTop: 4 }}>📷 Image shared</Text>
              ) : null}
              <Text style={{ color: '#cbd5e1', fontSize: 11, marginTop: 4 }}>
                {new Date(item.createdAt).toLocaleTimeString()}
              </Text>
            </View>
          );
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
        <Button mode="outlined" onPress={pickImage} style={{ alignSelf: 'center' }}>Photo</Button>
        <TextInput
          mode="outlined"
          style={{ flex: 1 }}
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          dense
        />
        <Button mode="contained" onPress={send} loading={sending} disabled={!text.trim()} style={{ alignSelf: 'center' }}>
          Send
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
