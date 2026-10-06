import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Badge, Text } from 'react-native-paper';
import { displayName, timeAgo } from '../lib/format';
import { placeLabel } from '../lib/places';
import type { ConversationSummary } from '../social/types';
import { useAppTheme } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

export function conversationTitle(c: Pick<ConversationSummary, 'kind' | 'title' | 'place_key' | 'other_display_name' | 'other_username'>) {
  if (c.kind === 'direct') return displayName({ display_name: c.other_display_name, username: c.other_username });
  if (c.kind === 'place') return c.title || placeLabel(c.place_key);
  return c.title || 'Crew chat';
}

export function ConversationRow({ c }: { c: ConversationSummary }) {
  const { colors } = useAppTheme();
  const title = conversationTitle(c);
  const unread = c.unread_count > 0 && !c.muted;
  return (
    <Pressable
      onPress={() => router.push(`/chat/${c.id}`)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={`${title}${unread ? `, ${c.unread_count} unread` : ''}`}
    >
      {c.kind === 'direct' ? (
        <Avatar id={c.other_user_id} name={title} path={c.other_avatar_path} size={50} />
      ) : (
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 16,
            backgroundColor: c.kind === 'place' ? colors.secondaryContainer : colors.tertiaryContainer,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={c.kind === 'place' ? 'map-marker-radius' : 'account-group'}
            size={24}
            color={c.kind === 'place' ? colors.onSecondaryContainer : colors.onTertiaryContainer}
          />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontWeight: unread ? '800' : '600', flex: 1 }} numberOfLines={1}>
            {title}
          </Text>
          {c.muted ? <Icon name="bell-off-outline" size={14} color={colors.muted} /> : null}
          <Text style={{ color: unread ? colors.primary : colors.muted, fontSize: 12 }}>
            {timeAgo(c.last_message_at ?? c.created_at)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={{ color: unread ? colors.onSurface : colors.muted, flex: 1 }} numberOfLines={1}>
            {c.last_message_preview || (c.kind === 'place' ? `${c.member_count} travellers in this room` : 'Say hello 👋')}
          </Text>
          {unread ? <Badge>{c.unread_count > 99 ? '99+' : c.unread_count}</Badge> : null}
        </View>
      </View>
    </Pressable>
  );
}
