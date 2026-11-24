import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

// Browser preview only: lottie-react-native needs an extra web player, so animations are skipped
// here and the screens show their still versions. Phones use Lottie.tsx.

export type AnimationName = 'confetti' | 'stamp' | 'travel';

export const lottieAvailable = false;

type Props = { name: AnimationName; loop?: boolean; style?: StyleProp<ViewStyle>; tint?: string; onFinish?: () => void };

export function Lottie({ onFinish }: Props) {
  useEffect(() => {
    if (!onFinish) return;
    const t = setTimeout(onFinish, 0);
    return () => clearTimeout(t);
  }, [onFinish]);
  return null;
}
