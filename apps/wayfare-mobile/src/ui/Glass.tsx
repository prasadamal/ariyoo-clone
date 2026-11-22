import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';

/**
 * Wayfare's glass: the floating layer (tab bar, buttons and panels over photos) is see-through glass,
 * in the spirit of Apple's Liquid Glass. Content itself (moments, lists, numbers) stays solid.
 *
 *   iPhone on iOS 26+         Apple's real Liquid Glass (expo-glass-effect).
 *   Older iPhones, web        a frosted blur with a bright rim and a soft shine.
 *   Android                   the same frosted look; real blur where the area behind is wrapped in a
 *                             <GlassArea> (the journey cover), a light frosted panel elsewhere.
 *   "Reduce transparency" on  plain solid panels, so text stays readable.
 */

export type GlassVariant =
  /** Light glass over the app's own background: the tab bar, sheets. */
  | 'surface'
  /** Dark-tinted glass over photos and the cover colour, for white text and icons. */
  | 'media';

type Props = ViewProps & {
  variant?: GlassVariant;
  /** Corner radius; glass is always clipped to its shape. */
  radius?: number;
  /** Colour the glass, e.g. the brand colour for a main button. */
  tint?: string;
  /** Responds to touch on iOS 26 (the glass reacts under your finger). */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

const liquidGlass = (() => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

/** True where the real Apple material is used (iOS 26+). */
export const hasLiquidGlass = liquidGlass;

// Android blurs only what sits inside a BlurTargetView; <GlassArea> provides one for the glass in it.
const TargetContext = createContext<RefObject<View | null> | null>(null);

/** Wrap the background (a photo, a gradient) that glass floats over, so Android can blur it too. */
export function GlassArea({ background, children, style }: { background: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<View | null>(null);
  return (
    <TargetContext.Provider value={ref}>
      <View style={style}>
        <BlurTargetView ref={ref} style={StyleSheet.absoluteFill}>
          {background}
        </BlurTargetView>
        {children}
      </View>
    </TargetContext.Provider>
  );
}

function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    // iOS has this setting; Android reports false; the web build has no such function at all.
    if (typeof AccessibilityInfo.isReduceTransparencyEnabled !== 'function') return;
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then(v => alive && setReduce(v))
      .catch(() => undefined);
    let sub: { remove: () => void } | undefined;
    try {
      sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    } catch {
      sub = undefined;
    }
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

/** "#6a01a3" + 0.8 → "rgba(194,65,12,0.8)". Other colour formats are returned unchanged. */
export function withAlpha(color: string, alpha: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function Glass({ variant = 'surface', radius = 20, tint, interactive, style, children, ...rest }: Props) {
  const theme = useAppTheme();
  const { colors, dark } = theme;
  const target = useContext(TargetContext);
  const reduce = useReduceTransparency();
  const media = variant === 'media';

  if (liquidGlass && !reduce) {
    return (
      <GlassView
        {...rest}
        glassEffectStyle={media ? 'clear' : 'regular'}
        colorScheme={media ? 'dark' : dark ? 'dark' : 'light'}
        tintColor={tint}
        isInteractive={interactive}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      >
        {children}
      </GlassView>
    );
  }

  // Real blur on iOS (before 26) and web; on Android only inside a <GlassArea>.
  const blur = !reduce && (Platform.OS !== 'android' || target != null);
  const veil = reduce
    ? tint ?? (media ? 'rgba(20,16,14,0.92)' : colors.surface)
    : tint
      ? withAlpha(tint, blur ? 0.78 : 0.92)
      : media
        ? blur
          ? 'rgba(20,16,14,0.22)'
          : 'rgba(20,16,14,0.38)'
        : dark
          ? blur
            ? 'rgba(28,25,23,0.62)'
            : 'rgba(28,25,23,0.9)'
          : blur
            ? 'rgba(255,255,255,0.6)'
            : 'rgba(255,255,255,0.9)';
  const rim = media || tint ? 'rgba(255,255,255,0.28)' : dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)';

  return (
    <View
      {...rest}
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: reduce ? colors.border : rim,
        },
        style,
      ]}
    >
      {blur ? (
        <BlurView
          intensity={media ? 30 : 45}
          tint={media || dark ? 'dark' : 'light'}
          blurTarget={target ?? undefined}
          blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'}
          // Rounded itself too: a browser's backdrop blur ignores the parent's rounded clipping.
          style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
        />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: veil }]} />
      {reduce ? null : (
        // The shine: light catching the top edge of the glass.
        <LinearGradient
          pointerEvents="none"
          colors={[media || tint || dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}
