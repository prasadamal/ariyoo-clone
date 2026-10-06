import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { displayName } from '../lib/format';
import { useAppTheme } from '../theme';
import { Avatar } from '../ui/Avatar';
import { TierBadge } from '../ui/TierBadge';

type Props = {
  id: string;
  username: string | null;
  name: string | null;
  avatarPath: string | null;
  tier?: string | null;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  size?: number;
};

export function UserRow({ id, username, name, avatarPath, tier, subtitle, right, onPress, size = 44 }: Props) {
  const { colors } = useAppTheme();
  const label = displayName({ display_name: name, username });
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/user/${id}`))}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={`${label}${subtitle ? `, ${subtitle}` : ''}`}
    >
      <Avatar id={id} name={label} path={avatarPath} size={size} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
            {label}
          </Text>
          <TierBadge tier={tier} compact />
        </View>
        {username && label !== `@${username}` ? (
          <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
            @{username}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, marginTop: 1 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}
