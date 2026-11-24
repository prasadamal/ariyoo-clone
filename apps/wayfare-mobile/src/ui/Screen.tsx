import type React from 'react';
import { useRef, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
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

/** Gap kept between the box you are typing in (or its cursor) and the top of the keyboard. */
const KEYBOARD_GAP = 24;

/**
 * Standard screen scaffold: themed background, pull-to-refresh, and typing that stays visible.
 * The keyboard tracker (react-native-keyboard-controller) scrolls the box you're typing in, or the
 * cursor in a long note, to just above the keyboard as it slides in, on Android and iOS alike, also
 * when you move to another box while the keyboard stays open.
 */
export function Screen({ children, scroll = true, padded = true, refreshing, onRefresh, contentStyle, footer, bottomSpace = 0, onEndReached, scrollRef: outerRef }: Props) {
  const { colors } = useAppTheme();
  const innerRef = useRef<ScrollView | null>(null);
  const scrollRef = outerRef ?? innerRef;
  const pad = padded ? { padding: 16, paddingBottom: 48 + bottomSpace } : bottomSpace ? { paddingBottom: bottomSpace } : null;

  if (!scroll) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding">
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
        {footer}
      </KeyboardAvoidingView>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView
        ref={scrollRef as React.Ref<never>}
        style={{ flex: 1 }}
        contentContainerStyle={[pad, contentStyle]}
        bottomOffset={KEYBOARD_GAP}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={e => {
          if (!onEndReached) return;
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
          if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 400) onEndReached();
        }}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined
        }
      >
        {children}
      </KeyboardAwareScrollView>
      {/* A bar under the page rides up with the keyboard. */}
      {footer ? <KeyboardStickyView>{footer}</KeyboardStickyView> : null}
    </View>
  );
}
