import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';
import { useAppTheme } from '../theme';
import { Icon } from './Icon';
import { Lottie, lottieAvailable, type AnimationName } from './Lottie';

type Props = {
  icon: string;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  compact?: boolean;
  /** A small looping animation in place of the icon (phones only; the icon shows otherwise). */
  animation?: AnimationName;
};

export function EmptyState({ icon, title, body, action, onAction, secondary, onSecondary, compact, animation }: Props) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const animate = animation && lottieAvailable && !reduceMotion;
  const size = compact ? 96 : 150;
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? 20 : 40, paddingHorizontal: 24 }}>
      {animate ? (
        <View style={{ width: size, height: size, marginBottom: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Lottie name={animation} loop style={{ width: size, height: size }} />
        </View>
      ) : (
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
      )}
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
