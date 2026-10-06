import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, Share, View } from 'react-native';
import { Button, Dialog, IconButton, Menu, Portal, Text, TextInput } from 'react-native-paper';
import { uuid } from '../../src/lib/id';
import { conversationTitle } from '../../src/components/ConversationRow';
import { GuidelinesGate } from '../../src/components/GuidelinesGate';
import { ReportDialog } from '../../src/components/ReportDialog';
import { UserRow } from '../../src/components/UserRow';
import { useAuth } from '../../src/context/AuthContext';
import { useInbox } from '../../src/context/InboxContext';
import { useToast } from '../../src/context/ToastContext';
import { pickPhotos } from '../../src/features/trip/photoPicker';
import { displayName, formatDay, toDayString } from '../../src/lib/format';
import { mapsLink } from '../../src/lib/sosMessage';
import {
  chatImageUrl,
  deleteMessage,
  getConversation,
  joinPlaceRoom,
  leaveConversation,
  listMembers,
  markRead,
  messagesPage,
  removeMember,
  sendImage,
  sendLocation,
  sendText,
  setMuted,
  subscribeToConversation,
  type ConversationView,
} from '../../src/social/chat';
import { block } from '../../src/social/profiles';
import type { ChatMessage, ConversationMember } from '../../src/social/types';
import { useAppTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/Icon';
import { PhotoViewer } from '../../src/ui/PhotoGrid';

function ChatImage({ message }: { message: ChatMessage }) {
  const [uri, setUri] = useState<string | null>(message.local_uri ?? null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!uri && message.media_path) chatImageUrl(message.media_path).then(setUri);
  }, [message.media_path, uri]);
  if (!uri) return <View style={{ width: 200, height: 200, borderRadius: 14, backgroundColor: '#0002' }} />;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="Open photo">
        <Image source={{ uri }} style={{ width: 220, height: 220, borderRadius: 14 }} contentFit="cover" transition={120} />
      </Pressable>
      <PhotoViewer uris={[uri]} index={open ? 0 : null} onClose={() => setOpen(false)} />
    </>
  );
}

function Chat({ id }: { id: string }) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { setActiveConversation, refresh: refreshInbox } = useInbox();
  const toast = useToast();
  const [conv, setConv] = useState<ConversationView | null | undefined>(undefined);
  const [members, setMembers] = useState<Record<string, ConversationMember>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [reporting, setReporting] = useState<{ type: 'message' | 'conversation'; id: string } | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const membersRef = useRef(members);
  membersRef.current = members;
  const me = user?.id;

  const scheduleRead = useCallback(() => {
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(async () => {
      await markRead(id);
      refreshInbox();
    }, 800);
  }, [id, refreshInbox]);

  const loadMembers = useCallback(async () => {
    const list = await listMembers(id).catch(() => []);
    setMembers(Object.fromEntries(list.map(m => [m.user_id, m])));
  }, [id]);

  const load = useCallback(async () => {
    try {
      const c = await getConversation(id);
      setConv(c);
      if (c?.joined) {
        const [page] = await Promise.all([messagesPage(id), loadMembers()]);
        setMessages(page);
        setNoMore(page.length < 40);
        scheduleRead();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not open chat');
      setConv(null);
    }
  }, [id, loadMembers, scheduleRead, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      setActiveConversation(id);
      return () => setActiveConversation(null);
    }, [id, setActiveConversation])
  );

  useEffect(() => {
    if (!conv?.joined) return;
    const unsubscribe = subscribeToConversation(id, {
      onInsert: m => {
        setMessages(prev => (prev.some(x => x.id === m.id) ? prev.map(x => (x.id === m.id ? m : x)) : [m, ...prev]));
        if (!membersRef.current[m.sender_id]) loadMembers();
        scheduleRead();
      },
      onDelete: removedId => setMessages(prev => prev.filter(x => x.id !== removedId)),
    });
    return () => {
      unsubscribe();
      if (readTimer.current) clearTimeout(readTimer.current);
    };
  }, [id, conv?.joined, loadMembers, scheduleRead]);

  const loadOlder = async () => {
    if (loadingOlder || noMore || !messages.length) return;
    setLoadingOlder(true);
    const oldest = messages[messages.length - 1].created_at;
    const page = await messagesPage(id, oldest).catch(() => []);
    setMessages(prev => [...prev, ...page.filter(p => !prev.some(x => x.id === p.id))]);
    setNoMore(page.length < 40);
    setLoadingOlder(false);
  };

  const optimistic = (partial: Partial<ChatMessage>): ChatMessage => ({
    id: uuid(),
    conversation_id: id,
    sender_id: me ?? '',
    kind: 'text',
    body: null,
    media_path: null,
    latitude: null,
    longitude: null,
    created_at: new Date().toISOString(),
    pending: true,
    ...partial,
  });

  const deliver = async (m: ChatMessage, send: () => Promise<ChatMessage>) => {
    setMessages(prev => [m, ...prev.filter(x => x.id !== m.id)]);
    try {
      const saved = await send();
      setMessages(prev => prev.map(x => (x.id === m.id ? saved : x)));
    } catch (e) {
      setMessages(prev => prev.map(x => (x.id === m.id ? { ...x, pending: false, failed: true } : x)));
      toast(e instanceof Error ? e.message : 'Message not sent — tap it to retry');
    }
  };

  const sendDraft = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const m = optimistic({ kind: 'text', body });
    deliver(m, () => sendText(id, m.id, body));
  };

  const sendPhoto = async () => {
    try {
      const [photo] = await pickPhotos(false);
      if (!photo) return;
      const m = optimistic({ kind: 'image', local_uri: photo.uri });
      deliver(m, () => sendImage(id, m.id, photo.uri, photo));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add photo');
    }
  };

  const shareLocation = () =>
    Alert.alert('Share your location?', 'Everyone in this chat will see where you are right now.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Share',
        onPress: async () => {
          try {
            const perm = await Location.requestForegroundPermissionsAsync();
            if (!perm.granted) throw new Error('Location permission is needed.');
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const m = optimistic({ kind: 'location', latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            deliver(m, () => sendLocation(id, m.id, pos.coords.latitude, pos.coords.longitude));
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not get location');
          }
        },
      },
    ]);

  const retry = (m: ChatMessage) => {
    const fresh = { ...m, pending: true, failed: false };
    if (m.kind === 'image' && m.local_uri) deliver(fresh, () => sendImage(id, m.id, m.local_uri as string));
    else if (m.kind === 'location' && m.latitude != null && m.longitude != null) deliver(fresh, () => sendLocation(id, m.id, m.latitude as number, m.longitude as number));
    else if (m.body) deliver(fresh, () => sendText(id, m.id, m.body as string));
  };

  const onLongPress = (m: ChatMessage) => {
    if (m.kind === 'system' || m.pending) return;
    const mine = m.sender_id === me;
    const sender = members[m.sender_id];
    Alert.alert('Message', undefined, [
      ...(m.body
        ? [
            {
              text: 'Copy text',
              onPress: async () => {
                await Clipboard.setStringAsync(m.body as string);
                toast('Copied');
              },
            },
          ]
        : []),
      ...(mine
        ? [
            {
              text: 'Unsend',
              style: 'destructive' as const,
              onPress: async () => {
                setMessages(prev => prev.filter(x => x.id !== m.id));
                await deleteMessage(m.id).catch(() => load());
              },
            },
          ]
        : [
            { text: 'Report', onPress: () => setReporting({ type: 'message', id: m.id }) },
            {
              text: `Block ${displayName(sender)}`,
              style: 'destructive' as const,
              onPress: async () => {
                await block(m.sender_id).catch(() => undefined);
                setMessages(prev => prev.filter(x => x.sender_id !== m.sender_id));
                toast('Blocked');
              },
            },
          ]),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const leave = () =>
    Alert.alert(conv?.kind === 'direct' ? 'Hide this chat?' : 'Leave this chat?', conv?.kind === 'direct' ? 'It comes back if they message you again.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: conv?.kind === 'direct' ? 'Hide' : 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveConversation(id).catch(() => undefined);
          refreshInbox();
          router.back();
        },
      },
    ]);

  const memberList = useMemo(() => Object.values(members), [members]);
  const iAmAdmin = !!me && ['owner', 'admin'].includes(members[me]?.role ?? '');

  if (conv === undefined) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!conv) return <EmptyState icon="message-off-outline" title="Chat unavailable" body="You may have left it, or it was removed." />;

  const title = conversationTitle(conv);

  if (!conv.joined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Stack.Screen options={{ title }} />
        <EmptyState
          icon="forum-outline"
          title={`${title} room`}
          body={`${conv.member_count} traveller${conv.member_count === 1 ? '' : 's'} chatting about trail conditions, rides, permits and meetups.`}
          action="Join the room"
          onAction={async () => {
            try {
              await joinPlaceRoom(conv.place_key ?? '', title);
              refreshInbox();
              load();
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Could not join');
            }
          }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Menu visible={menu} onDismiss={() => setMenu(false)} anchor={<IconButton icon="dots-vertical" onPress={() => setMenu(true)} accessibilityLabel="Chat options" />}>
              {conv.kind === 'direct' && conv.other_user_id ? (
                <Menu.Item leadingIcon="account-outline" title="View profile" onPress={() => { setMenu(false); router.push(`/user/${conv.other_user_id}`); }} />
              ) : (
                <Menu.Item leadingIcon="account-multiple-outline" title={`Members (${conv.member_count})`} onPress={() => { setMenu(false); setShowMembers(true); }} />
              )}
              {conv.kind === 'group' && conv.invite_code ? (
                <Menu.Item
                  leadingIcon="account-plus-outline"
                  title="Invite with code"
                  onPress={() => {
                    setMenu(false);
                    Share.share({ message: `Join "${title}" on Wayfare 🎒\nInvite code: ${conv.invite_code}\nwayfare://join/${conv.invite_code}` });
                  }}
                />
              ) : null}
              {conv.kind === 'place' && conv.place_key ? (
                <Menu.Item leadingIcon="map-marker-radius-outline" title="Destination guide" onPress={() => { setMenu(false); router.push(`/place/${conv.place_key}`); }} />
              ) : null}
              <Menu.Item
                leadingIcon={conv.muted ? 'bell-outline' : 'bell-off-outline'}
                title={conv.muted ? 'Unmute' : 'Mute'}
                onPress={async () => {
                  setMenu(false);
                  await setMuted(id, !conv.muted).catch(() => undefined);
                  setConv({ ...conv, muted: !conv.muted });
                  refreshInbox();
                }}
              />
              {conv.kind !== 'direct' ? (
                <Menu.Item leadingIcon="flag-outline" title="Report chat" onPress={() => { setMenu(false); setReporting({ type: 'conversation', id }); }} />
              ) : null}
              <Menu.Item leadingIcon="exit-to-app" title={conv.kind === 'direct' ? 'Hide chat' : 'Leave'} onPress={() => { setMenu(false); leave(); }} />
            </Menu>
          ),
        }}
      />
      <FlatList
        inverted
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 12 }}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingOlder ? <ActivityIndicator style={{ margin: 12 }} /> : null}
        ListEmptyComponent={
          <View style={{ transform: [{ scaleY: -1 }] }}>
            <EmptyState compact icon="hand-wave-outline" title="Say hello" body="Introduce yourself and your plans. Meet in public places first and never send money in advance." />
          </View>
        }
        renderItem={({ item, index }) => {
          const older = messages[index + 1];
          const day = toDayString(new Date(item.created_at));
          const showDay = !older || toDayString(new Date(older.created_at)) !== day;
          const mine = item.sender_id === me;
          const sender = members[item.sender_id];
          const showSender = !mine && conv.kind !== 'direct' && (!older || older.sender_id !== item.sender_id || showDay);
          const time = new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          return (
            <View>
              {showDay ? (
                <Text style={{ alignSelf: 'center', color: colors.muted, fontSize: 12, marginVertical: 10 }}>
                  {formatDay(day, { weekday: true, year: new Date(item.created_at).getFullYear() !== new Date().getFullYear() })}
                </Text>
              ) : null}
              {item.kind === 'system' ? (
                <Text style={{ alignSelf: 'center', color: colors.muted, fontSize: 12, marginVertical: 6 }}>{item.body}</Text>
              ) : (
                <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6, marginVertical: 2 }}>
                  {!mine && conv.kind !== 'direct' ? (
                    <View style={{ width: 28 }}>
                      {showSender ? <Avatar id={item.sender_id} name={displayName(sender)} path={sender?.avatar_path} size={28} /> : null}
                    </View>
                  ) : null}
                  <Pressable
                    onLongPress={() => onLongPress(item)}
                    onPress={item.failed ? () => retry(item) : undefined}
                    style={{
                      maxWidth: '78%',
                      backgroundColor: item.kind === 'image' ? 'transparent' : mine ? colors.bubbleMine : colors.bubbleTheirs,
                      borderRadius: 18,
                      borderBottomRightRadius: mine ? 4 : 18,
                      borderBottomLeftRadius: mine ? 18 : 4,
                      paddingHorizontal: item.kind === 'image' ? 0 : 12,
                      paddingVertical: item.kind === 'image' ? 0 : 8,
                      opacity: item.pending ? 0.6 : 1,
                    }}
                    accessibilityHint={item.failed ? 'Not sent. Tap to retry.' : undefined}
                  >
                    {showSender ? (
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.tertiary, marginBottom: 2 }} onPress={() => router.push(`/user/${item.sender_id}`)}>
                        {displayName(sender)}
                      </Text>
                    ) : null}
                    {item.kind === 'image' ? <ChatImage message={item} /> : null}
                    {item.kind === 'location' && item.latitude != null && item.longitude != null ? (
                      <Pressable onPress={() => Linking.openURL(mapsLink(item.latitude as number, item.longitude as number))} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole="link">
                        <Icon name="map-marker" size={20} color={mine ? colors.onBubbleMine : colors.primary} />
                        <Text style={{ color: mine ? colors.onBubbleMine : colors.onBubbleTheirs, fontWeight: '700', textDecorationLine: 'underline' }}>Shared location — open map</Text>
                      </Pressable>
                    ) : null}
                    {item.kind === 'text' && item.body ? <Text style={{ color: mine ? colors.onBubbleMine : colors.onBubbleTheirs, lineHeight: 20 }}>{item.body}</Text> : null}
                    <Text style={{ fontSize: 10, marginTop: 2, alignSelf: 'flex-end', color: item.kind === 'image' ? colors.muted : mine ? '#ffffffbb' : colors.muted }}>
                      {item.failed ? '⚠ Not sent · tap to retry' : item.pending ? 'Sending…' : time}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, padding: 6, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
        <IconButton icon="image-plus" onPress={sendPhoto} accessibilityLabel="Send a photo" />
        <IconButton icon="map-marker-outline" onPress={shareLocation} accessibilityLabel="Share location" />
        <TextInput mode="outlined" dense placeholder="Message" value={draft} onChangeText={setDraft} multiline style={{ flex: 1, maxHeight: 120 }} maxLength={4000} />
        <IconButton icon="send" iconColor={colors.primary} onPress={sendDraft} disabled={!draft.trim()} accessibilityLabel="Send message" />
      </View>

      <Portal>
        <Dialog visible={showMembers} onDismiss={() => setShowMembers(false)} style={{ maxHeight: '80%' }}>
          <Dialog.Title>{conv.member_count} in this chat</Dialog.Title>
          <Dialog.ScrollArea>
            <FlatList
              data={memberList}
              keyExtractor={m => m.user_id}
              renderItem={({ item }) => (
                <UserRow
                  id={item.user_id}
                  username={item.username}
                  name={item.display_name}
                  avatarPath={item.avatar_path}
                  tier={item.tier}
                  subtitle={item.role !== 'member' ? item.role : undefined}
                  onPress={() => {
                    setShowMembers(false);
                    router.push(`/user/${item.user_id}`);
                  }}
                  right={
                    iAmAdmin && conv.kind === 'group' && item.user_id !== me && item.role !== 'owner' ? (
                      <IconButton
                        icon="account-remove-outline"
                        onPress={async () => {
                          await removeMember(id, item.user_id).catch(e => toast(e instanceof Error ? e.message : 'Could not remove'));
                          loadMembers();
                        }}
                        accessibilityLabel={`Remove ${displayName(item)}`}
                      />
                    ) : undefined
                  }
                />
              )}
            />
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowMembers(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {reporting ? <ReportDialog visible onDismiss={() => setReporting(null)} targetType={reporting.type} targetId={reporting.id} /> : null}
    </KeyboardAvoidingView>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <GuidelinesGate what="chat with travellers">
      <Chat id={String(id)} />
    </GuidelinesGate>
  );
}
