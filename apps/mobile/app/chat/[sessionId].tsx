import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Dialog, IconButton, Menu, Portal, RadioButton, Text, TextInput } from 'react-native-paper';
import io from 'socket.io-client';
import { api, errorCode, errorMessage } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { getApiBaseUrl } from '../../src/config';
import { chatReducer, initialChatState, type ChatMessage } from '../../src/chatState';
import { closeAction, expertRecord, resolvedBanner, type ExpertStats } from '../../src/lib/resolve';
import { photoResizeTarget } from '../../src/lib/validation';

type SessionInfo = {
  title: string;
  active: boolean;
  role: 'seeker' | 'solver';
  waiting: boolean;
  peer: { userId: number; fullName: string } | null;
  blocked: boolean;
  resolved?: boolean;
  helpful?: boolean | null;
  peerStats?: ExpertStats | null;
};

const REASONS: { value: string; label: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'spam', label: 'Spam' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'unsafe_advice', label: 'Dangerous advice' },
  { value: 'other', label: 'Something else' },
];

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
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<'report' | 'block' | 'resolve' | null>(null);
  const [reason, setReason] = useState('harassment');
  const [details, setDetails] = useState('');
  const [working, setWorking] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const request = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(false);
  const list = useRef<FlatList<ChatMessage>>(null);
  const { messages } = state;
  const sending = state.operation !== 'idle';
  const closed = !!info && (!info.active || info.blocked);
  const canWrite = state.load === 'ready' && !closed;

  const loadInfo = useCallback(async () => {
    try {
      const res = await api.get<SessionInfo>(`/api/Message/session/${sid}`);
      if (mounted.current) setInfo(res.data);
    } catch {
      // The message load below reports the failure.
    }
  }, [sid]);

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
    void loadInfo();
    const socket = io(getApiBaseUrl(), { transports: ['websocket'], auth: { token: user.token } });
    // Rejoin and reconcile missed messages after a socket reconnect.
    socket.on('connect', () => {
      socket.emit('join', String(sid));
      void loadMessages();
    });
    socket.on('message', (m: ChatMessage & { sessionId: number }) => {
      if (Number(m.sessionId) !== sid) return;
      dispatch({ type: 'received', message: m });
      // The first reply from an expert is also when "waiting" ends and the peer becomes known.
      if (m.senderId !== user.userId) void loadInfo();
    });
    return () => {
      mounted.current = false;
      socket.disconnect();
    };
  }, [sid, user, loadMessages, loadInfo]);

  const refused = (e: unknown, fallback: string) => {
    if (errorCode(e) === 'CHAT_CLOSED') void loadInfo();
    return errorMessage(e, fallback);
  };

  const send = async () => {
    if (!user || !text.trim() || busy.current || !canWrite) return;
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
    } catch (e: unknown) {
      if (mounted.current) dispatch({ type: 'failed', error: refused(e, 'Message not sent. Your draft is saved here; try again.') });
    } finally {
      busy.current = false;
    }
  };

  const pickImage = async () => {
    if (!user || busy.current || !canWrite) return;
    busy.current = true;
    dispatch({ type: 'operation', operation: 'picking' });
    let failure: string | null = null;
    try {
      // The system photo picker needs no permission: the app only receives the chosen photo.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled || !result.assets[0] || !mounted.current) return;
      dispatch({ type: 'operation', operation: 'uploading' });
      const asset = result.assets[0];
      // Shrink before upload: faster on mobile data, and photos are stored in a small free database.
      const context = ImageManipulator.manipulate(asset.uri);
      const target = photoResizeTarget(asset.width, asset.height);
      if (target) context.resize(target);
      const rendered = await context.renderAsync();
      const small = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
      const form = new FormData();
      form.append('senderId', String(user.userId));
      form.append('sessionId', String(sid));
      form.append('image', {
        uri: small.uri, name: 'upload.jpg', type: 'image/jpeg',
      } as unknown as Blob);
      const res = await api.post<ChatMessage>('/api/Message/uploadImage', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (mounted.current) dispatch({ type: 'received', message: res.data });
    } catch (e: unknown) {
      failure = refused(e, 'Photo not sent. Please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) dispatch(failure ? { type: 'failed', error: failure } : { type: 'operation', operation: 'idle' });
    }
  };

  const closeDialog = () => { if (!working) { setDialog(null); setDialogError(''); setDetails(''); } };

  const submitSafety = async () => {
    if (!info?.peer || working) return;
    setWorking(true);
    setDialogError('');
    try {
      if (dialog === 'report') {
        await api.post('/api/safety/report', { userId: info.peer.userId, sessionId: sid, reason, details: details.trim() || undefined, block: true });
      } else {
        await api.post('/api/safety/block', { userId: info.peer.userId });
      }
      if (!mounted.current) return;
      setDialog(null);
      setDetails('');
      // Blocked conversations leave the list, so there is nothing more to do here.
      router.back();
    } catch (e: unknown) {
      if (mounted.current) setDialogError(errorMessage(e, 'That did not go through. Please try again.'));
    } finally {
      if (mounted.current) setWorking(false);
    }
  };

  const closing = info ? closeAction(info) : null;

  const resolve = async (helpful?: boolean) => {
    if (working) return;
    setWorking(true);
    setDialogError('');
    try {
      await api.post(`/api/Message/resolve/${sid}`, helpful === undefined ? {} : { helpful });
      if (!mounted.current) return;
      setDialog(null);
      await loadInfo();
    } catch (e: unknown) {
      // Closed on another device in the meantime: show the conversation as it now is.
      if (errorCode(e) === 'ALREADY_RESOLVED') {
        setDialog(null);
        void loadInfo();
      } else if (mounted.current) {
        setDialogError(errorMessage(e, 'That did not go through. Please try again.'));
      }
    } finally {
      if (mounted.current) setWorking(false);
    }
  };

  const record = info?.role === 'seeker' ? expertRecord(info.peerStats) : null;
  const banner = closed
    ? (info && resolvedBanner(info, info.peer?.fullName)) ?? 'This conversation is closed.'
    : info?.waiting
      ? info.role === 'seeker' ? 'Waiting for an expert to pick this up. You will be notified when someone answers.' : null
      : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <Stack.Screen
        options={{
          title: info?.peer?.fullName ?? 'Conversation',
          headerRight: () =>
            info?.peer || closing ? (
              <Menu
                visible={menu}
                onDismiss={() => setMenu(false)}
                anchor={<IconButton icon="dots-vertical" iconColor="#f8fafc" accessibilityLabel="Conversation options" onPress={() => setMenu(true)} />}
              >
                {closing ? (
                  <Menu.Item
                    leadingIcon={closing === 'answered' ? 'check-circle-outline' : 'close-circle-outline'}
                    title={closing === 'answered' ? 'Mark as answered' : 'Withdraw question'}
                    onPress={() => { setMenu(false); setDialogError(''); setDialog('resolve'); }}
                  />
                ) : null}
                {info?.peer ? <Menu.Item leadingIcon="flag-outline" title="Report" onPress={() => { setMenu(false); setDialog('report'); }} /> : null}
                {info?.peer ? <Menu.Item leadingIcon="block-helper" title="Block" onPress={() => { setMenu(false); setDialog('block'); }} /> : null}
              </Menu>
            ) : null,
        }}
      />
      {state.load === 'loading' && messages.length === 0 ? <Text style={{ padding: 12 }}>Loading conversation…</Text> : null}
      {record ? <Text style={{ paddingHorizontal: 12, paddingTop: 8, color: '#94a3b8' }} accessibilityLabel={`Expert record: ${record}`}>{record}</Text> : null}
      {banner ? <Text style={{ padding: 12, color: '#94a3b8', backgroundColor: '#1e293b' }}>{banner}</Text> : null}
      {closing === 'answered' && messages.some(m => m.senderId !== user?.userId) ? (
        <Button mode="contained-tonal" icon="check-circle-outline" onPress={() => { setDialogError(''); setDialog('resolve'); }} style={{ marginHorizontal: 12, marginTop: 8 }}>
          Got your answer? Mark it answered
        </Button>
      ) : null}
      {state.error ? (
        <View style={{ padding: 12 }}>
          <Text accessibilityRole="alert" style={{ color: '#f87171' }}>{state.error}</Text>
          {state.load === 'error' ? <Button onPress={loadMessages}>Retry loading</Button> : null}
        </View>
      ) : null}
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12 }}
        data={messages}
        keyExtractor={(item, idx) => String(item.id ?? `local-${idx}`)}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
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
              {item.messageText ? <Text selectable style={{ color: '#f8fafc' }}>{item.messageText}</Text> : null}
              {item.imageUrl ? (
                <Image
                  accessibilityLabel="Photo"
                  source={{ uri: item.imageUrl.startsWith('http') ? item.imageUrl : `${getApiBaseUrl()}${item.imageUrl}`, headers: { Authorization: `Bearer ${user?.token}` } }}
                  style={{ width: 220, height: 160, borderRadius: 8, marginTop: 6 }}
                  resizeMode="cover"
                />
              ) : null}
              <Text style={{ color: '#cbd5e1', fontSize: 11, marginTop: 4 }}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
      />
      {closed ? null : (
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
          <IconButton icon="image-outline" mode="outlined" accessibilityLabel="Send a photo" onPress={pickImage} disabled={sending || !canWrite} style={{ alignSelf: 'center', margin: 0 }} />
          <TextInput
            mode="outlined"
            style={{ flex: 1, maxHeight: 120 }}
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            multiline
            maxLength={10000}
            dense
          />
          <Button mode="contained" onPress={send} loading={state.operation === 'sending'} disabled={!text.trim() || sending || !canWrite} style={{ alignSelf: 'center' }}>
            Send
          </Button>
        </View>
      )}

      <Portal>
        <Dialog visible={dialog === 'resolve'} onDismiss={closeDialog}>
          <Dialog.Title>{closing === 'withdraw' ? 'Withdraw this question?' : `Did ${info?.peer?.fullName ?? 'the expert'}'s answer help?`}</Dialog.Title>
          <Dialog.Content>
            <Text>
              {closing === 'withdraw'
                ? 'Experts will no longer see it. You can always ask again.'
                : 'The conversation closes for both of you. If it helped, we will let them know.'}
            </Text>
            {dialogError ? <Text accessibilityRole="alert" style={{ color: '#f87171', marginTop: 8 }}>{dialogError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeDialog} disabled={working}>Cancel</Button>
            {closing === 'withdraw' ? (
              <Button onPress={() => resolve()} loading={working} disabled={working}>Withdraw</Button>
            ) : (
              <>
                <Button onPress={() => resolve(false)} disabled={working}>Not really</Button>
                <Button mode="contained" onPress={() => resolve(true)} loading={working} disabled={working}>Yes, it helped</Button>
              </>
            )}
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={dialog === 'report' || dialog === 'block'} onDismiss={closeDialog}>
          <Dialog.Title>{dialog === 'report' ? `Report ${info?.peer?.fullName ?? ''}` : `Block ${info?.peer?.fullName ?? ''}?`}</Dialog.Title>
          <Dialog.Content>
            {dialog === 'report' ? (
              <>
                <RadioButton.Group value={reason} onValueChange={setReason}>
                  {REASONS.map(r => <RadioButton.Item key={r.value} value={r.value} label={r.label} mode="android" style={{ paddingVertical: 0 }} />)}
                </RadioButton.Group>
                <TextInput mode="outlined" label="Anything else we should know (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} style={{ marginTop: 8 }} />
                <Text style={{ color: '#94a3b8', marginTop: 8 }}>We review reports within 24 hours. This person will also be blocked.</Text>
              </>
            ) : (
              <Text>You will no longer see each other's messages, and you will not be matched again. They are not told.</Text>
            )}
            {dialogError ? <Text accessibilityRole="alert" style={{ color: '#f87171', marginTop: 8 }}>{dialogError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeDialog} disabled={working}>Cancel</Button>
            <Button onPress={submitSafety} loading={working} disabled={working} textColor="#f87171">
              {dialog === 'report' ? 'Send report' : 'Block'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}
