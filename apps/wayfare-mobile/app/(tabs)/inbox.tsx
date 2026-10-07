import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { Button, Dialog, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { ConversationRow } from '../../src/components/ConversationRow';
import { GuidelinesGate } from '../../src/components/GuidelinesGate';
import { useInbox } from '../../src/context/InboxContext';
import { useToast } from '../../src/context/ToastContext';
import { timeAgo } from '../../src/lib/format';
import { enablePush, getPushPreference } from '../../src/lib/notifications';
import { joinByCode } from '../../src/social/chat';
import {
  markAllNotificationsRead,
  notificationIcon,
  notificationsPage,
  notificationTarget,
  notificationText,
} from '../../src/social/notifications';
import type { AppNotification } from '../../src/social/types';
import { useAppTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/Icon';
import { SectionHeader } from '../../src/ui/SectionHeader';

type InboxView = 'chats' | 'activity';

function PushPrompt() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [show, setShow] = useState(false);
  useEffect(() => {
    getPushPreference().then(p => setShow(p === 'unset'));
  }, []);
  if (!show) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.primaryContainer, marginBottom: 12 }}>
      <Icon name="bell-ring-outline" size={22} color={colors.onPrimaryContainer} />
      <Text style={{ flex: 1, color: colors.onPrimaryContainer, fontSize: 13 }}>Get notified about messages, join requests and travellers on your dates.</Text>
      <Button
        compact
        mode="contained"
        onPress={async () => {
          const r = await enablePush().catch(e => ({ ok: false, message: e instanceof Error ? e.message : 'Could not enable' }));
          toast(r.message);
          setShow(false);
        }}
      >
        Turn on
      </Button>
    </View>
  );
}

function Chats() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const { conversations, refresh, loading } = useInbox();
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const people = conversations.filter(c => c.kind !== 'place');
  const rooms = conversations.filter(c => c.kind === 'place');

  const join = async () => {
    try {
      const id = await joinByCode(code);
      setJoinOpen(false);
      setCode('');
      await refresh();
      router.push(`/chat/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Invalid code');
    }
  };

  return (
    <>
      <FlatList
        data={people}
        keyExtractor={c => c.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
        refreshing={loading}
        onRefresh={refresh}
        ListHeaderComponent={
          <View>
            <PushPrompt />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              <Button mode="outlined" compact icon="key-variant" onPress={() => setJoinOpen(true)}>
                Join with code
              </Button>
              <Button mode="outlined" compact icon="account-search-outline" onPress={() => router.push('/search')}>
                Find travellers
              </Button>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              compact
              icon="message-text-outline"
              title="No conversations yet"
              body="Say hi to travellers on your dates, ask to join a board plan, or start a crew chat from any journey."
              action="Meet travellers"
              onAction={() => router.push('/(tabs)/connect')}
            />
          )
        }
        renderItem={({ item }) => <ConversationRow c={item} />}
        ListFooterComponent={
          rooms.length ? (
            <View>
              <SectionHeader title="Destination rooms" />
              {rooms.map(r => (
                <ConversationRow key={r.id} c={r} />
              ))}
            </View>
          ) : null
        }
      />
      <Portal>
        <Dialog visible={joinOpen} onDismiss={() => setJoinOpen(false)}>
          <Dialog.Title>Join a crew</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.muted, marginBottom: 8 }}>Enter the 8-character invite code a friend shared.</Text>
            <TextInput mode="outlined" label="Invite code" value={code} onChangeText={t => setCode(t.toUpperCase())} autoCapitalize="characters" maxLength={8} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setJoinOpen(false)}>Cancel</Button>
            <Button mode="contained" onPress={join} disabled={code.trim().length < 6}>
              Join
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

function Activity() {
  const { colors } = useAppTheme();
  const { refresh: refreshInbox } = useInbox();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await notificationsPage();
      setItems(page);
      setDone(page.length < 40);
      if (page.some(n => !n.read_at)) {
        await markAllNotificationsRead();
        refreshInbox();
      }
    } catch {
      setItems([]);
    }
  }, [refreshInbox]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const more = async () => {
    if (done || loadingMore || !items?.length) return;
    setLoadingMore(true);
    const page = await notificationsPage(items[items.length - 1].created_at).catch(() => []);
    setItems([...items, ...page]);
    setDone(page.length < 40);
    setLoadingMore(false);
  };

  if (items === null) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <FlatList
      data={items}
      keyExtractor={n => n.id}
      contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
      onRefresh={load}
      refreshing={false}
      onEndReached={more}
      ListEmptyComponent={
        <EmptyState compact icon="bell-outline" title="All quiet" body="Follows, likes, comments, join requests and trip matches show up here." />
      }
      renderItem={({ item }) => {
        const unread = !item.read_at;
        return (
          <Pressable
            onPress={() => router.push(notificationTarget(item) as never)}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}
            accessibilityRole="button"
          >
            <View>
              <Avatar id={item.actor_id} name={item.actor_display_name ?? item.actor_username} path={item.actor_avatar_path} size={44} />
              <View style={{ position: 'absolute', right: -4, bottom: -4, backgroundColor: colors.primary, borderRadius: 10, padding: 3 }}>
                <Icon name={notificationIcon(item)} size={12} color={colors.onPrimary} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: unread ? '700' : '400', lineHeight: 19 }} numberOfLines={3}>
                {notificationText(item)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{timeAgo(item.created_at)}</Text>
            </View>
            {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

export default function InboxTab() {
  const { colors } = useAppTheme();
  const { unreadMessages, unreadNotifications } = useInbox();
  const [view, setView] = useState<InboxView>('chats');
  const buttons = useMemo(
    () => [
      { value: 'chats', label: unreadMessages ? `Chats (${unreadMessages})` : 'Chats', icon: 'forum-outline' },
      { value: 'activity', label: unreadNotifications ? `Activity (${unreadNotifications})` : 'Activity', icon: 'bell-outline' },
    ],
    [unreadMessages, unreadNotifications]
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GuidelinesGate what="chat with travellers">
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <SegmentedButtons value={view} onValueChange={v => setView(v as InboxView)} buttons={buttons} />
        </View>
        {view === 'chats' ? <Chats /> : <Activity />}
      </GuidelinesGate>
    </View>
  );
}
