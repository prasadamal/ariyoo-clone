import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../theme';
import { Icon } from './Icon';

type Props = {
  label: string;
  icon?: string;
  color?: string;
  background?: string;
  onPress?: () => void;
  selected?: boolean;
};

export function Pill({ label, icon, color, background, onPress, selected }: Props) {
  const { colors } = useAppTheme();
  const fg = selected ? colors.onPrimary : color ?? colors.onSurfaceVariant;
  const bg = selected ? colors.primary : background ?? colors.surfaceVariant;
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: bg,
        alignSelf: 'flex-start',
      }}
    >
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} hitSlop={4}>
      {body}
    </Pressable>
  );
}
