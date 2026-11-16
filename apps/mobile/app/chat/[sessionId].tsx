import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import io from 'socket.io-client';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { getApiBaseUrl } from '../../src/config';
import { chatReducer, initialChatState, type ChatMessage } from '../../src/chatState';

export default function ChatScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const sid = Number(sessionId);
  const { user } = useAuth();
  // A key gives each account/session its own state and discards late results on navigation.
  return <ChatConversation key={`${user?.userId}:${sid}`} sid={sid} />;
}

function ChatConversation({ sid }: { sid: number }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [text, setText] = useState('');
  const request = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(false);
  const { messages } = state;
  const sending = state.operation !== 'idle';

  const loadMessages = useCallback(async () => {
    const id = ++request.current;
    dispatch({ type: 'load', request: id });
    try {
      const res = await api.get<ChatMessage[]>(`/api/Message/getMessagesBySessionId/${sid}`);
      if (mounted.current) dispatch({ type: 'loaded', request: id, messages: res.data });
    } catch {
      if (mounted.current) dispatch({ type: 'loadFailed', request: id, error: 'Could not load messages. Try again.' });
    }
  }, [sid]);

  useEffect(() => {
    mounted.current = true;
    if (!Number.isSafeInteger(sid) || sid <= 0 || !user) {
      dispatch({ type: 'loadFailed', request: 0, error: 'This conversation is unavailable.' });
      return () => { mounted.current = false; };
    }
    void loadMessages();
    const socket = io(getApiBaseUrl(), { transports: ['websocket'], auth: { token: user.token } });
    // Rejoin and reconcile missed messages after a socket reconnect.
    socket.on('connect', () => {
      socket.emit('join', String(sid));
      void loadMessages();
    });
    socket.on('message', (m: ChatMessage & { sessionId: number }) => {
      if (Number(m.sessionId) === sid) dispatch({ type: 'received', message: m });
    });
    return () => {
      mounted.current = false;
      socket.disconnect();
    };
  }, [sid, user, loadMessages]);

  const send = async () => {
    if (!user || !text.trim() || busy.current || state.load !== 'ready') return;
    busy.current = true;
    dispatch({ type: 'operation', operation: 'sending' });
    const submitted = text;
    try {
      const res = await api.post<ChatMessage>('/api/Message/postMessage', {
        senderId: user.userId, messageText: submitted.trim(), sessionId: sid,
      });
      if (!mounted.current) return;
      dispatch({ type: 'received', message: res.data });
      // Preserve anything typed while this message was being sent.
      setText(current => current === submitted ? '' : current);
      dispatch({ type: 'operation', operation: 'idle' });
    } catch {
      if (mounted.current) dispatch({ type: 'failed', error: 'Message not sent. Your draft is saved here; try again.' });
    } finally {
      busy.current = false;
    }
  };

  const pickImage = async () => {
    if (!user || busy.current || state.load !== 'ready') return;
    busy.current = true;
    dispatch({ type: 'operation', operation: 'picking' });
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        dispatch({ type: 'failed', error: 'Photo access is required to attach an image.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
      });
      if (result.canceled || !result.assets[0] || !mounted.current) return;
      dispatch({ type: 'operation', operation: 'uploading' });
      const asset = result.assets[0];
      const form = new FormData();
      form.append('senderId', String(user.userId));
      form.append('sessionId', String(sid));
      form.append('image', {
        uri: asset.uri, name: 'upload.jpg', type: asset.mimeType || 'image/jpeg',
      } as unknown as Blob);
      const res = await api.post<ChatMessage>('/api/Message/uploadImage', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (mounted.current) dispatch({ type: 'received', message: res.data });
    } catch {
      if (mounted.current) dispatch({ type: 'failed', error: 'Photo not sent. Please try again.' });
    } finally {
      busy.current = false;
      // Keep failure text while releasing the operation below.
      if (mounted.current) dispatch({ type: 'operation', operation: 'idle' });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {state.load === 'loading' ? <Text style={{ padding: 12 }}>Loading conversation…</Text> : null}
      {state.error ? (
        <View style={{ padding: 12 }}>
          <Text accessibilityRole="alert">{state.error}</Text>
          {state.load === 'error' ? <Button onPress={loadMessages}>Retry loading</Button> : null}
        </View>
      ) : null}
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
                <Image
                  source={{ uri: item.imageUrl.startsWith('http') ? item.imageUrl : `${getApiBaseUrl()}${item.imageUrl}`, headers: { Authorization: `Bearer ${user?.token}` } }}
                  style={{ width: 220, height: 160, borderRadius: 8, marginTop: 6 }}
                  resizeMode="cover"
                />
              ) : null}
              <Text style={{ color: '#cbd5e1', fontSize: 11, marginTop: 4 }}>
                {new Date(item.createdAt).toLocaleTimeString()}
              </Text>
            </View>
          );
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
        <Button mode="outlined" onPress={pickImage} disabled={sending || state.load !== 'ready'} style={{ alignSelf: 'center' }}>Photo</Button>
        <TextInput
          mode="outlined"
          style={{ flex: 1 }}
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          dense
        />
        <Button mode="contained" onPress={send} loading={state.operation === 'sending'} disabled={!text.trim() || sending || state.load !== 'ready'} style={{ alignSelf: 'center' }}>
          Send
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

