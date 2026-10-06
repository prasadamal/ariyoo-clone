import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import { IconButton, Menu, Text } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { displayName, formatKm, timeAgo } from '../lib/format';
import { fromLngLatPairs } from '../lib/geo';
import { deletePost, postMediaUrl, setLiked } from '../social/feed';
import { block } from '../social/profiles';
import type { FeedPost } from '../social/types';
import { useAppTheme } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { PhotoGrid } from '../ui/PhotoGrid';
import { Pill } from '../ui/Pill';
import { RouteSparkline } from '../ui/RouteSparkline';
import { TierBadge } from '../ui/TierBadge';
import { ReportDialog } from './ReportDialog';

type Props = {
  post: FeedPost;
  onChanged?: (post: FeedPost) => void;
  onDeleted?: (id: string) => void;
  onBlocked?: (userId: string) => void;
  showCommentsLink?: boolean;
};

export function PostCard({ post, onChanged, onDeleted, onBlocked, showCommentsLink = true }: Props) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const mine = user?.id === post.user_id;
  const name = displayName({ display_name: post.author_display_name, username: post.author_username });
  const route = fromLngLatPairs(post.route_preview);

  const toggleLike = async () => {
    const liked = !post.liked_by_me;
    const next = { ...post, liked_by_me: liked, like_count: Math.max(0, post.like_count + (liked ? 1 : -1)) };
    onChanged?.(next);
    try {
      await setLiked(post.id, liked);
    } catch (e) {
      onChanged?.(post);
      toast(e instanceof Error ? e.message : 'Could not update like');
    }
  };

  const remove = () =>
    Alert.alert('Delete post?', 'This removes it from every feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post);
            onDeleted?.(post.id);
            toast('Post deleted');
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not delete');
          }
        },
      },
    ]);

  const blockAuthor = () =>
    Alert.alert(`Block ${name}?`, 'You will no longer see each other’s posts, profiles or messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await block(post.user_id);
            onBlocked?.(post.user_id);
            toast(`${name} is blocked`);
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not block');
          }
        },
      },
    ]);

  const sharePost = () =>
    Share.share({
      message: `${name} on Wayfare${post.place_name ? ` · ${post.place_name}` : ''}\n\n${post.body ?? ''}\n\nOpen in Wayfare: wayfare://post/${post.id}`,
    });

  const stats = post.stats ?? {};

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 8, gap: 10 }}>
        <Pressable onPress={() => router.push(`/user/${post.user_id}`)} accessibilityLabel={`Open ${name}'s profile`}>
          <Avatar id={post.user_id} name={name} path={post.author_avatar_path} size={40} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontWeight: '700', flexShrink: 1 }} numberOfLines={1} onPress={() => router.push(`/user/${post.user_id}`)}>
              {name}
            </Text>
            <TierBadge tier={post.author_tier} compact />
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
            {timeAgo(post.created_at)}
            {post.place_name ? ' · ' : ''}
            {post.place_name ? (
              <Text
                style={{ color: colors.secondary, fontSize: 12, fontWeight: '600' }}
                onPress={post.place_key ? () => router.push(`/place/${post.place_key}`) : undefined}
              >
                {post.place_name}
              </Text>
            ) : null}
            {post.visibility === 'followers' ? ' · Followers' : ''}
          </Text>
        </View>
        <Menu
          visible={menu}
          onDismiss={() => setMenu(false)}
          anchor={<IconButton icon="dots-horizontal" size={20} onPress={() => setMenu(true)} accessibilityLabel="Post options" />}
        >
          <Menu.Item leadingIcon="share-variant" title="Share" onPress={() => { setMenu(false); sharePost(); }} />
          {mine ? (
            <Menu.Item leadingIcon="delete-outline" title="Delete" onPress={() => { setMenu(false); remove(); }} />
          ) : (
            <>
              <Menu.Item leadingIcon="flag-outline" title="Report" onPress={() => { setMenu(false); setReporting(true); }} />
              <Menu.Item leadingIcon="account-cancel-outline" title={`Block ${name}`} onPress={() => { setMenu(false); blockAuthor(); }} />
            </>
          )}
        </Menu>
      </View>

      {post.body ? (
        <Pressable onPress={showCommentsLink ? () => router.push(`/post/${post.id}`) : undefined}>
          <Text style={{ paddingHorizontal: 14, paddingBottom: 10, lineHeight: 21 }}>{post.body}</Text>
        </Pressable>
      ) : null}

      {post.media.length ? (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
          <PhotoGrid uris={post.media.map(m => postMediaUrl(m.path)).filter(Boolean)} />
        </View>
      ) : null}

      {route.length > 1 ? (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
          <RouteSparkline points={route} height={130} />
          <View style={{ position: 'absolute', left: 20, top: 8, flexDirection: 'row', gap: 6 }}>
            <Pill icon="check-decagram" label={`${formatKm(post.route_km ?? 0)} GPS-verified`} color={colors.onSecondary} background={colors.secondary} />
          </View>
        </View>
      ) : null}

      {post.kind === 'trip' && Object.keys(stats).length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 10 }}>
          {stats.days ? <Pill icon="calendar-range" label={`${stats.days} days`} /> : null}
          {stats.entries ? <Pill icon="notebook-outline" label={`${stats.entries} entries`} /> : null}
          {stats.max_altitude_m ? <Pill icon="image-filter-hdr" label={`${Number(stats.max_altitude_m).toLocaleString('en-IN')} m high`} /> : null}
          {stats.photos ? <Pill icon="camera-outline" label={`${stats.photos} photos`} /> : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={toggleLike}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 6 }}
          accessibilityRole="button"
          accessibilityLabel={post.liked_by_me ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: post.liked_by_me }}
        >
          <Icon name={post.liked_by_me ? 'heart' : 'heart-outline'} size={22} color={post.liked_by_me ? colors.danger : colors.onSurfaceVariant} />
          <Text style={{ color: colors.onSurfaceVariant }}>{post.like_count || ''}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/post/${post.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`${post.comment_count} comments`}
        >
          <Icon name="comment-outline" size={21} color={colors.onSurfaceVariant} />
          <Text style={{ color: colors.onSurfaceVariant }}>{post.comment_count || ''}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {post.place_key ? (
          <Pressable onPress={() => router.push(`/place/${post.place_key}`)} style={{ padding: 10 }} accessibilityLabel="Open destination">
            <Icon name="map-marker-radius-outline" size={21} color={colors.secondary} />
          </Pressable>
        ) : null}
      </View>

      <ReportDialog
        visible={reporting}
        onDismiss={() => setReporting(false)}
        targetType="post"
        targetId={post.id}
        onBlock={blockAuthor}
      />
    </View>
  );
}
