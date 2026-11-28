import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type Props = {
  uri: string;
  width: number;
  height: number;
  /** Told when the photo is zoomed in or back to fit (the viewer stops paging while zoomed). */
  onZoomChange?: (zoomed: boolean) => void;
  /** A single tap (no zoom): the viewer shows or hides its buttons. */
  onTap?: () => void;
  /** Dragging moves the photo only while zoomed; otherwise sideways swipes page between photos. */
  zoomed?: boolean;
};

/**
 * A full-screen photo you can zoom: double-tap to zoom in where you tapped (again to fit), pinch to
 * zoom, and drag around while zoomed. Runs on the UI thread, so it follows the fingers smoothly.
 */
export function ZoomableImage({ uri, width, height, onZoomChange, onTap, zoomed: panEnabled = false }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const gesture = useMemo(() => {
    const zoomed = (on: boolean) => onZoomChange?.(on);
    const tapped = () => onTap?.();
    // How far the picture may move at a given zoom before its edge would leave the screen.
    const limitX = (s: number) => {
      'worklet';
      return ((s - 1) * width) / 2;
    };
    const limitY = (s: number) => {
      'worklet';
      return ((s - 1) * height) / 2;
    };
    const clamp = (v: number, max: number) => {
      'worklet';
      return Math.min(max, Math.max(-max, v));
    };
    const reset = () => {
      'worklet';
      scale.value = withTiming(1);
      savedScale.value = 1;
      x.value = withTiming(0);
      y.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
      runOnJS(zoomed)(false);
    };

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(300)
      .onEnd(e => {
        if (savedScale.value > 1.05) {
          reset();
          return;
        }
        const s = DOUBLE_TAP_SCALE;
        // Zoom toward the spot you tapped.
        const tx = clamp((width / 2 - e.x) * (s - 1), limitX(s));
        const ty = clamp((height / 2 - e.y) * (s - 1), limitY(s));
        scale.value = withTiming(s);
        savedScale.value = s;
        x.value = withTiming(tx);
        y.value = withTiming(ty);
        savedX.value = tx;
        savedY.value = ty;
        runOnJS(zoomed)(true);
      });
    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .onEnd(() => {
        runOnJS(tapped)();
      });
    const pinch = Gesture.Pinch()
      .onUpdate(e => {
        scale.value = Math.max(1, Math.min(MAX_SCALE, savedScale.value * e.scale));
      })
      .onEnd(() => {
        if (scale.value <= 1.02) reset();
        else {
          savedScale.value = scale.value;
          x.value = withTiming(clamp(x.value, limitX(scale.value)));
          y.value = withTiming(clamp(y.value, limitY(scale.value)));
          savedX.value = clamp(x.value, limitX(scale.value));
          savedY.value = clamp(y.value, limitY(scale.value));
          runOnJS(zoomed)(true);
        }
      });
    // Dragging moves a zoomed photo; at normal size it does nothing, so sideways swipes page.
    const pan = Gesture.Pan()
      .enabled(panEnabled)
      .averageTouches(true)
      .onUpdate(e => {
        if (savedScale.value <= 1.02) return;
        x.value = clamp(savedX.value + e.translationX, limitX(scale.value));
        y.value = clamp(savedY.value + e.translationY, limitY(scale.value));
      })
      .onEnd(() => {
        savedX.value = x.value;
        savedY.value = y.value;
      });
    return Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, onZoomChange, onTap, panEnabled]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Reanimated.View style={[{ width, height, overflow: 'hidden' }]} collapsable={false}>
        <Reanimated.View style={[{ width, height }, style]}>
          <Image source={{ uri }} style={{ width, height }} contentFit="contain" accessibilityIgnoresInvertColors />
        </Reanimated.View>
      </Reanimated.View>
    </GestureDetector>
  );
}
