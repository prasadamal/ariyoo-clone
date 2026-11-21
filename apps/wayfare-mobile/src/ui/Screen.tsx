import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
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
};

/** Standard screen scaffold: themed background, keyboard-safe scrolling, optional pull-to-refresh. */
export function Screen({ children, scroll = true, padded = true, refreshing, onRefresh, contentStyle, footer }: Props) {
  const { colors } = useAppTheme();
  const pad = padded ? { padding: 16, paddingBottom: 48 } : null;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      // Android draws edge to edge, so it no longer resizes the window by itself: pad it like iOS so the
      // box you are typing in stays above the keyboard.
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[pad, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
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
