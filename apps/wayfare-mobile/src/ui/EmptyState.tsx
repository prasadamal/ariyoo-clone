import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useAppTheme } from '../theme';
import { Icon } from './Icon';

type Props = {
  icon: string;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  compact?: boolean;
};

export function EmptyState({ icon, title, body, action, onAction, secondary, onSecondary, compact }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? 20 : 40, paddingHorizontal: 24 }}>
      <View
        style={{
          width: compact ? 52 : 72,
          height: compact ? 52 : 72,
          borderRadius: 999,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Icon name={icon} size={compact ? 26 : 34} color={colors.primary} />
      </View>
      <Text variant="titleMedium" style={{ fontWeight: '700', textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>{body}</Text>
      ) : null}
      {action && onAction ? (
        <Button mode="contained" style={{ marginTop: 16 }} onPress={onAction}>
          {action}
        </Button>
      ) : null}
      {secondary && onSecondary ? (
        <Button style={{ marginTop: 6 }} onPress={onSecondary}>
          {secondary}
        </Button>
      ) : null}
    </View>
  );
}
