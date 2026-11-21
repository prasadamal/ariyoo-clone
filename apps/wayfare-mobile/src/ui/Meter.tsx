import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';

type Props = {
  /** 0 to 1; values outside are clamped. */
  progress: number;
  color: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * A plain progress bar. Used instead of react-native-paper's ProgressBar, which in a browser
 * stretches to the height of its container and pushes the text below it out of place.
 */
export function Meter({ progress, color, height = 8, style, accessibilityLabel }: Props) {
  const { colors } = useAppTheme();
  const value = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[{ height, borderRadius: height / 2, backgroundColor: colors.surfaceVariant, overflow: 'hidden' }, style]}
    >
      <View style={{ width: `${value * 100}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}
