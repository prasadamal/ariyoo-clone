import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../theme';
import { Icon } from './Icon';

export function StatTile({ value, label, icon, tint }: { value: string; label: string; icon?: string; tint?: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 90,
        padding: 12,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {icon ? <Icon name={icon} size={18} color={tint ?? colors.primary} /> : null}
      <Text variant="titleLarge" style={{ fontWeight: '800', marginTop: icon ? 6 : 0 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>;
}
