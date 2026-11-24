import LottieView from 'lottie-react-native';
import type { StyleProp, ViewStyle } from 'react-native';

/** Wayfare's own animations (made by scripts/make-animations.py). */
const ANIMATIONS = {
  confetti: require('../../assets/animations/confetti.json'),
  stamp: require('../../assets/animations/stamp.json'),
  travel: require('../../assets/animations/travel.json'),
};

export type AnimationName = keyof typeof ANIMATIONS;

/** Phones play Lottie animations; the browser preview shows the still fallbacks instead. */
export const lottieAvailable = true;

type Props = {
  name: AnimationName;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Recolours the "ink" layers (the passport stamp's splash takes the stamp's colour). */
  tint?: string;
  onFinish?: () => void;
};

export function Lottie({ name, loop = false, style, tint, onFinish }: Props) {
  return (
    <LottieView
      source={ANIMATIONS[name]}
      autoPlay
      loop={loop}
      style={style}
      resizeMode="contain"
      colorFilters={tint ? [{ keypath: 'ink', color: tint }] : undefined}
      onAnimationFinish={onFinish ? () => onFinish() : undefined}
    />
  );
}
