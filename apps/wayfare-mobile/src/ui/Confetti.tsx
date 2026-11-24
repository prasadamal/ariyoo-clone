import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { Lottie } from './Lottie';

/**
 * A burst of confetti over the whole screen. Change `burst` (any new number above 0) to play it
 * again. Skipped when the phone asks for reduced motion; it never blocks taps.
 */
export function Confetti({ burst }: { burst: number }) {
  const [playing, setPlaying] = useState(0);

  useEffect(() => {
    if (burst <= 0) return;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduce => {
        if (!alive || reduce) return;
        setPlaying(burst);
        if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      });
    return () => {
      alive = false;
    };
  }, [burst]);

  if (!playing) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Lottie key={playing} name="confetti" style={StyleSheet.absoluteFill} onFinish={() => setPlaying(0)} />
    </View>
  );
}
