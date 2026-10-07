import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../theme';
import { Icon } from './Icon';

type Tone = 'info' | 'success' | 'warning' | 'error';

/** Inline status message (errors, offline hints, confirmations). */
export function Notice({ tone = 'info', text, icon }: { tone?: Tone; text: string; icon?: string }) {
  const { colors } = useAppTheme();
  const color = tone === 'error' ? colors.error : tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.info;
  const defaultIcon =
    tone === 'error' ? 'alert-circle-outline' : tone === 'warning' ? 'alert-outline' : tone === 'success' ? 'check-circle-outline' : 'information-outline';
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: color,
        marginVertical: 6,
      }}
      accessibilityRole="alert"
    >
      <Icon name={icon ?? defaultIcon} size={18} color={color} />
      <Text style={{ flex: 1, color: colors.onSurface, fontSize: 13, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}
