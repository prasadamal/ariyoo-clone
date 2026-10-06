import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { ActivityIndicator, IconButton, Text, TextInput } from 'react-native-paper';
import { PostCard } from '../../src/components/PostCard';
import { ReportDialog } from '../../src/components/ReportDialog';
import { useAuth } from '../../src/context/AuthContext';
import { useToast } from '../../src/context/ToastContext';
import { displayName, timeAgo } from '../../src/lib/format';
import { addComment, deleteComment, getPost, listComments } from '../../src/social/feed';
import type { FeedPost, PostComment } from '../../src/social/types';
import { useAppTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { EmptyState } from '../../src/ui/EmptyState';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = String(id);
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [post, setPost] = useState<FeedPost | null | undefined>(undefined);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([getPost(postId), listComments(postId)]);
      setPost(p);
      setComments(c);
    } catch (e) {
      setPost(null);
      toast(e instanceof Error ? e.message : 'Could not load post');
    }
  }, [postId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await addComment(postId, draft);
      setDraft('');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not comment');
    } finally {
      setSending(false);
    }
  };

  const commentActions = (c: PostComment) => {
    const mine = c.user_id === user?.id;
    const canDelete = mine || post?.user_id === user?.id;
    Alert.alert('Comment', undefined, [
      ...(canDelete
        ? [
            {
              text: 'Delete',
              style: 'destructive' as const,
              onPress: async () => {
                try {
                  await deleteComment(c.id);
                  await load();
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Could not delete');
                }
              },
            },
          ]
        : []),
      ...(!mine ? [{ text: 'Report', onPress: () => setReporting(c.id) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  if (post === undefined) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!post) return <EmptyState icon="eye-off-outline" title="Post unavailable" body="It may have been deleted, hidden after reports, or shared with followers only." />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={comments}
        keyExtractor={c => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            <PostCard post={post} onChanged={setPost} onDeleted={() => router.back()} onBlocked={() => router.back()} showCommentsLink={false} />
            <Text style={{ fontWeight: '800', marginBottom: 8 }}>
              {comments.length ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'No comments yet'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => commentActions(item)} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
            <Pressable onPress={() => router.push(`/user/${item.user_id}`)}>
              <Avatar id={item.user_id} name={displayName({ display_name: item.author_display_name, username: item.author_username })} path={item.author_avatar_path} size={34} />
            </Pressable>
            <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontWeight: '700', fontSize: 13 }}>
                {displayName({ display_name: item.author_display_name, username: item.author_username })}
                <Text style={{ color: colors.muted, fontWeight: '400', fontSize: 12 }}> · {timeAgo(item.created_at)}</Text>
              </Text>
              <Text style={{ marginTop: 2, lineHeight: 20 }}>{item.body}</Text>
            </View>
          </Pressable>
        )}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
        <TextInput
          mode="outlined"
          dense
          placeholder="Add a kind comment…"
          value={draft}
          onChangeText={setDraft}
          style={{ flex: 1 }}
          maxLength={1000}
          multiline
        />
        <IconButton icon="send" iconColor={colors.primary} onPress={send} disabled={sending || !draft.trim()} accessibilityLabel="Send comment" />
      </View>
      {reporting ? <ReportDialog visible onDismiss={() => setReporting(null)} targetType="comment" targetId={reporting} /> : null}
    </KeyboardAvoidingView>
  );
}
