import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { displayName, formatDateRange, timeAgo } from '../lib/format';
import { boardKindMeta } from '../social/board';
import type { BoardPost } from '../social/types';
import { useAppTheme } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';

export function BoardCard({ post }: { post: BoardPost }) {
  const { colors } = useAppTheme();
  const meta = boardKindMeta(post.kind);
  const name = displayName({ display_name: post.author_display_name, username: post.author_username });
  const when = post.meet_at
    ? new Date(post.meet_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : formatDateRange(post.starts_on, post.ends_on);
  const spotsLeft = Math.max(0, post.spots - post.accepted_count);
  return (
    <Pressable
      onPress={() => router.push(`/board/${post.id}`)}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 12,
        opacity: pressed ? 0.85 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${post.title} at ${post.place_name}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{ backgroundColor: colors.tertiaryContainer, padding: 6, borderRadius: 10 }}>
          <Icon name={meta.icon} size={18} color={colors.onTertiaryContainer} />
        </View>
        <Text style={{ color: colors.tertiary, fontWeight: '700', fontSize: 12, flex: 1 }}>{meta.label.toUpperCase()}</Text>
        {post.status === 'full' ? <Pill label="Full" icon="lock-outline" /> : <Pill label={`${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`} icon="account-multiple-outline" color={colors.secondary} />}
      </View>
      <Text variant="titleMedium" style={{ fontWeight: '700' }} numberOfLines={2}>
        {post.title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <Pill icon="map-marker-outline" label={post.place_name} color={colors.secondary} />
        {when ? <Pill icon="calendar-blank-outline" label={when} /> : null}
        {post.budget_level ? <Pill icon="wallet-outline" label={post.budget_level} /> : null}
      </View>
      {post.body ? (
        <Text style={{ color: colors.onSurfaceVariant, marginTop: 8, lineHeight: 20 }} numberOfLines={3}>
          {post.body}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <Avatar id={post.user_id} name={name} path={post.author_avatar_path} size={24} />
        <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>
          {name} · {timeAgo(post.created_at)}
        </Text>
        {post.my_request_status === 'pending' ? <Pill label="Requested" icon="clock-outline" /> : null}
        {post.my_request_status === 'accepted' ? <Pill label="You're in" icon="check" color={colors.success} /> : null}
        {post.pending_count > 0 ? <Pill label={`${post.pending_count} request${post.pending_count === 1 ? '' : 's'}`} icon="hand-wave" selected /> : null}
      </View>
    </Pressable>
  );
}
