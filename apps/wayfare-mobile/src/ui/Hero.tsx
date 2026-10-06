import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';

type Variant = 'ember' | 'glacier' | 'violet';

export function Hero({ children, variant = 'ember', style }: { children: ReactNode; variant?: Variant; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  const stops: [string, string] =
    variant === 'glacier'
      ? [colors.tealStart, colors.tealEnd]
      : variant === 'violet'
        ? [colors.violetStart, colors.violetEnd]
        : [colors.heroStart, colors.heroEnd];
  return (
    <LinearGradient colors={stops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 20, padding: 18 }, style]}>
      {children}
    </LinearGradient>
  );
}
