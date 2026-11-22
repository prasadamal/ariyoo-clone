import type React from 'react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '../theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  /** Extra room at the bottom, e.g. for the floating tab bar (TAB_BAR_SPACE). */
  bottomSpace?: number;
  /** Called when you scroll near the bottom (to load the next page). */
  onEndReached?: () => void;
  /** Lets the page scroll itself (e.g. jump to a day). */
  scrollRef?: React.RefObject<ScrollView | null>;
};

/** Gap kept between the box you are typing in and the top of the keyboard. */
const KEYBOARD_GAP = 24;

/**
 * Standard screen scaffold: themed background, pull-to-refresh, and typing that stays visible.
 * Android draws edge to edge, so the keyboard covers the page instead of shrinking it: here the page
 * gains room at the bottom and scrolls the box you're typing in to just above the keyboard (also when
 * you move to another box while the keyboard is open). iOS does the same with its own keyboard insets.
 */
export function Screen({ children, scroll = true, padded = true, refreshing, onRefresh, contentStyle, footer, bottomSpace = 0, onEndReached, scrollRef: outerRef }: Props) {
  const { colors } = useAppTheme();
  const innerRef = useRef<ScrollView | null>(null);
  const scrollRef = outerRef ?? innerRef;
  const offset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [keyboard, setKeyboard] = useState(0);
  const android = Platform.OS === 'android';

  useEffect(() => {
    if (!android || !scroll) return;
    const reveal = () => {
      const top = keyboardTop.current;
      const input = TextInput.State.currentlyFocusedInput?.() as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
      if (top == null || !input?.measureInWindow) return;
      input.measureInWindow((_x, y, _w, h) => {
        const overlap = y + h + KEYBOARD_GAP - top;
        if (overlap > 0) scrollRef.current?.scrollTo({ y: offset.current + overlap, animated: true });
      });
    };
    const show = Keyboard.addListener('keyboardDidShow', e => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboard(e.endCoordinates.height);
      // Wait a frame for the extra bottom room before scrolling into it.
      setTimeout(reveal, 80);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboard(0);
    });
    // Moving to another box while the keyboard stays up.
    const poll = setInterval(() => {
      if (keyboardTop.current != null) reveal();
    }, 700);
    return () => {
      show.remove();
      hide.remove();
      clearInterval(poll);
    };
  }, [android, scroll]);

  const extra = bottomSpace + (android ? keyboard : 0);
  const pad = padded ? { padding: 16, paddingBottom: 48 + extra } : extra ? { paddingBottom: extra } : null;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      // iOS: lift the page by the keyboard. Android handles it above, inside the scroll view.
      behavior={Platform.OS === 'ios' || !scroll ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[pad, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          onScroll={e => {
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            offset.current = contentOffset.y;
            if (onEndReached && contentOffset.y + layoutMeasurement.height >= contentSize.height - 400) onEndReached();
          }}
          scrollEventThrottle={32}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
      {footer}
    </KeyboardAvoidingView>
  );
}
