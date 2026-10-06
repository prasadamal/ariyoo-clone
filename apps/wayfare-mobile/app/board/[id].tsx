import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Menu, Text, TextInput } from 'react-native-paper';
import { GuidelinesGate } from '../../src/components/GuidelinesGate';
import { ReportDialog } from '../../src/components/ReportDialog';
import { UserRow } from '../../src/components/UserRow';
import { MEETUP_SAFETY } from '../../src/content/safety';
import { useAuth } from '../../src/context/AuthContext';
import { useInbox } from '../../src/context/InboxContext';
import { useToast } from '../../src/context/ToastContext';
import { displayName, formatDateRange, timeAgo } from '../../src/lib/format';
import {
  boardKindMeta,
  deleteBoardPost,
  getBoardPost,
  requestToJoin,
  requestsForPost,
  respondToRequest,
  setBoardStatus,
  updateBoardSpots,
  withdrawRequest,
} from '../../src/social/board';
import { block } from '../../src/social/profiles';
import type { BoardPost, BoardRequest } from '../../src/social/types';
import { styleLabel } from '../../src/social/types';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/Icon';
import { Pill } from '../../src/ui/Pill';
import { Screen } from '../../src/ui/Screen';
import { SectionHeader } from '../../src/ui/SectionHeader';

function BoardDetail({ id }: { id: string }) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { refresh: refreshInbox } = useInbox();
  const toast = useToast();
  const [post, setPost] = useState<BoardPost | null | undefined>(undefined);
  const [requests, setRequests] = useState<BoardRequest[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await getBoardPost(id);
      setPost(p);
      if (p && p.user_id === user?.id) setRequests(await requestsForPost(p.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load');
      setPost(null);
    }
  }, [id, user?.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (post === undefined) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!post) return <EmptyState icon="bulletin-board" title="Post unavailable" body="It may have been removed or hidden after reports." />;

  const mine = post.user_id === user?.id;
  const meta = boardKindMeta(post.kind);
  const name = displayName({ display_name: post.author_display_name, username: post.author_username });
  const spotsLeft = Math.max(0, post.spots - post.accepted_count);
  const when = post.meet_at
    ? new Date(post.meet_at).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : formatDateRange(post.starts_on, post.ends_on);

  const act = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast(success);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const respond = (r: BoardRequest, accept: boolean) =>
    act(async () => {
      await respondToRequest(r.id, accept);
      if (accept) refreshInbox();
    }, accept ? `${displayName(r)} is in the crew chat 🎉` : 'Declined');

  const confirmBlock = () =>
    Alert.alert(`Block ${name}?`, 'You will no longer see each other’s posts, profiles or messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          act(async () => {
            await block(post.user_id);
            router.back();
          }),
      },
    ]);

  return (
    <Screen onRefresh={load} refreshing={false}>
      <Stack.Screen
        options={{
          title: meta.label,
          headerRight: () => (
            <Menu visible={menu} onDismiss={() => setMenu(false)} anchor={<IconButton icon="dots-vertical" onPress={() => setMenu(true)} accessibilityLabel="More" />}>
              {mine ? (
                <>
                  <Menu.Item
                    leadingIcon={post.status === 'closed' ? 'lock-open-outline' : 'lock-outline'}
                    title={post.status === 'closed' ? 'Reopen' : 'Close to new requests'}
                    onPress={() => {
                      setMenu(false);
                      act(() => setBoardStatus(post.id, post.status === 'closed' ? 'open' : 'closed'));
                    }}
                  />
                  <Menu.Item
                    leadingIcon="delete-outline"
                    title="Delete post"
                    onPress={() => {
                      setMenu(false);
                      Alert.alert('Delete this post?', 'The crew chat stays for people already in it.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => act(async () => { await deleteBoardPost(post.id); router.back(); }) },
                      ]);
                    }}
                  />
                </>
              ) : (
                <>
                  <Menu.Item leadingIcon="flag-outline" title="Report" onPress={() => { setMenu(false); setReporting(true); }} />
                  <Menu.Item leadingIcon="account-cancel-outline" title={`Block ${name}`} onPress={() => { setMenu(false); confirmBlock(); }} />
                </>
              )}
            </Menu>
          ),
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name={meta.icon} size={20} color={colors.tertiary} />
        <Text style={{ color: colors.tertiary, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>{meta.label.toUpperCase()}</Text>
        {post.status !== 'open' ? <Pill icon="lock-outline" label={post.status === 'full' ? 'Full' : 'Closed'} /> : null}
      </View>
      <Text variant="headlineSmall" style={{ fontWeight: '900', marginTop: 6 }}>
        {post.title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <Pill icon="map-marker-outline" label={post.place_name} color={colors.secondary} onPress={() => router.push(`/place/${post.place_key}`)} />
        {when ? <Pill icon="calendar-blank-outline" label={when} /> : null}
        <Pill icon="account-multiple-outline" label={`${spotsLeft} of ${post.spots} spots left`} />
        {post.budget_level ? <Pill icon="wallet-outline" label={post.budget_level} /> : null}
      </View>
      {post.body ? <Text style={{ marginTop: 14, lineHeight: 22 }}>{post.body}</Text> : null}
      <UserRow id={post.user_id} username={post.author_username} name={post.author_display_name} avatarPath={post.author_avatar_path} tier={post.author_tier} subtitle={`Organiser · posted ${timeAgo(post.created_at)} ago`} />

      {post.conversation_id ? (
        <Button mode="contained" icon="forum-outline" style={{ marginTop: 12 }} onPress={() => router.push(`/chat/${post.conversation_id}`)}>
          Open crew chat
        </Button>
      ) : null}

      {mine ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 }}>
            <Text style={{ flex: 1, fontWeight: '700' }}>Spots</Text>
            <IconButton icon="minus" mode="outlined" disabled={busy || post.spots <= Math.max(1, post.accepted_count)} onPress={() => act(() => updateBoardSpots(post.id, post.spots - 1))} accessibilityLabel="Fewer spots" />
            <Text style={{ fontWeight: '900', fontSize: 18 }}>{post.spots}</Text>
            <IconButton icon="plus" mode="outlined" disabled={busy || post.spots >= 50} onPress={() => act(() => updateBoardSpots(post.id, post.spots + 1))} accessibilityLabel="More spots" />
          </View>
          <SectionHeader title="Requests" subtitle={requests.length ? 'Accepted travellers join the crew chat automatically' : undefined} />
          {requests.length ? (
            requests.map(r => (
              <View key={r.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8, marginBottom: 6 }}>
                <UserRow
                  id={r.user_id}
                  username={r.username}
                  name={r.display_name}
                  avatarPath={r.avatar_path}
                  tier={r.tier}
                  subtitle={[r.message ? `“${r.message}”` : null, ...(r.travel_styles ?? []).slice(0, 2).map(styleLabel)].filter(Boolean).join(' · ')}
                />
                {r.status === 'pending' ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button mode="contained" compact onPress={() => respond(r, true)} disabled={busy || spotsLeft === 0} style={{ flex: 1 }}>
                      Accept
                    </Button>
                    <Button mode="outlined" compact onPress={() => respond(r, false)} disabled={busy} style={{ flex: 1 }}>
                      Decline
                    </Button>
                  </View>
                ) : (
                  <Pill label={r.status === 'accepted' ? 'In the crew' : 'Declined'} icon={r.status === 'accepted' ? 'check' : 'close'} color={r.status === 'accepted' ? colors.success : colors.muted} />
                )}
              </View>
            ))
          ) : (
            <Text style={{ color: colors.muted }}>No requests yet. Share it in a destination room to get noticed.</Text>
          )}
        </>
      ) : (
        <View style={{ marginTop: 16 }}>
          {post.my_request_status === 'accepted' ? (
            <Text style={{ color: colors.success, fontWeight: '700' }}>You are in! Plan the details in the crew chat.</Text>
          ) : post.my_request_status === 'pending' ? (
            <>
              <Text style={{ color: colors.muted }}>Request sent — you will get a notification when {name} responds.</Text>
              <Button style={{ marginTop: 8 }} onPress={() => act(() => withdrawRequest(post.id), 'Request withdrawn')} disabled={busy}>
                Withdraw request
              </Button>
            </>
          ) : post.my_request_status === 'declined' ? (
            <Text style={{ color: colors.muted }}>This one did not work out — check the board for similar plans.</Text>
          ) : post.status === 'open' ? (
            <>
              <TextInput mode="outlined" label={`Message to ${name}`} placeholder="A little about you and your plans" value={message} onChangeText={setMessage} multiline maxLength={500} />
              <Button mode="contained" icon="hand-wave" style={{ marginTop: 10 }} loading={busy} disabled={busy} onPress={() => act(() => requestToJoin(post.id, message), 'Request sent')}>
                Ask to join
              </Button>
            </>
          ) : (
            <Text style={{ color: colors.muted }}>This post is not taking requests.</Text>
          )}
        </View>
      )}

      <SectionHeader title="Meet safely" />
      {MEETUP_SAFETY.map(tip => (
        <View key={tip} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          <Icon name="shield-check-outline" size={16} color={colors.secondary} />
          <Text style={{ flex: 1, color: colors.onSurfaceVariant, fontSize: 13 }}>{tip}</Text>
        </View>
      ))}
      <ReportDialog visible={reporting} onDismiss={() => setReporting(false)} targetType="board_post" targetId={post.id} onBlock={confirmBlock} />
    </Screen>
  );
}

export default function BoardPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <GuidelinesGate what="join travel plans">
      <BoardDetail id={String(id)} />
    </GuidelinesGate>
  );
}
