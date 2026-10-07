import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useAppTheme } from '../theme';

type Props = { title: string; subtitle?: string; action?: string; onAction?: () => void; style?: object };

export function SectionHeader({ title, subtitle, action, onAction, style }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 20, marginBottom: 8 }, style]}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
          {title}
        </Text>
        {subtitle ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <Button compact onPress={onAction}>
          {action}
        </Button>
      ) : null}
    </View>
  );
}
