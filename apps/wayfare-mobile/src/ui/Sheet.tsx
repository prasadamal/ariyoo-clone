import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, TextInput as RNTextInput, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';
import { Icon } from './Icon';

// Browser preview only: react-native-web names this helper differently, and the sheet's text box
// calls it when typing ends. Phones have it built in.
if (Platform.OS === 'web') {
  const state = RNTextInput.State as unknown as { currentlyFocusedInput?: () => unknown; currentlyFocusedField?: () => unknown };
  if (state && !state.currentlyFocusedInput && state.currentlyFocusedField) state.currentlyFocusedInput = () => state.currentlyFocusedField?.();
}

type SheetProps = {
  visible: boolean;
  /** Called when the sheet is swiped down, the backdrop is tapped or back is pressed. */
  onDismiss: () => void;
  title?: string;
  /** A short line under the title. */
  subtitle?: string;
  children: ReactNode;
};

/**
 * A panel that slides up from the bottom (@gorhom/bottom-sheet), sized to what it holds.
 * Swipe it down, tap outside or press back to close. Typing inside lifts it above the keyboard.
 */
export function Sheet({ visible, onDismiss, title, subtitle, children }: SheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const shown = useRef(false);

  useEffect(() => {
    if (visible && !shown.current) {
      shown.current = true;
      ref.current?.present();
    } else if (!visible && shown.current) {
      shown.current = false;
      ref.current?.dismiss();
    }
  }, [visible]);

  // Android's back button (and Escape in the browser preview) closes the sheet instead of the screen.
  useEffect(() => {
    if (!visible) return;
    const close = () => ref.current?.dismiss();
    if (Platform.OS === 'web') {
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.45} />,
    []
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={() => {
        shown.current = false;
        onDismiss();
      }}
      enableDynamicSizing
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: colors.outline, width: 40 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      // The sheet lifts itself above the keyboard. Android doesn't shrink the screen for the keyboard
      // here (edge-to-edge, and the keyboard controller takes over the window's insets), so with
      // "adjustResize" the sheet waited for a resize that never came and the keyboard covered it.
      android_keyboardInputMode="adjustPan"
      accessibilityLabel={title}
    >
      <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
        {title ? (
          <Text variant="titleLarge" style={{ fontWeight: '800' }} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? <Text style={{ color: colors.muted, marginTop: 2 }}>{subtitle}</Text> : null}
        <View style={{ marginTop: title || subtitle ? 14 : 0 }}>{children}</View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

/** A Paper text box that tells the sheet when it is being typed in, so the sheet rises with the keyboard. */
export function SheetTextInput(props: ComponentProps<typeof TextInput>) {
  return <TextInput {...props} render={p => <BottomSheetTextInput {...(p as ComponentProps<typeof BottomSheetTextInput>)} />} />;
}

export type SheetAction = {
  icon: string;
  label: string;
  onPress: () => void;
  /** Red, for delete and similar. */
  danger?: boolean;
  hint?: string;
};

/** A list of actions in a sheet (in place of a small ⋯ menu): large rows that are easy to hit. */
export function SheetActions({ actions }: { actions: SheetAction[] }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginHorizontal: -8 }}>
      {actions.map(a => {
        const fg = a.danger ? colors.danger : colors.onSurface;
        return (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityHint={a.hint}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              minHeight: 54,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: pressed ? colors.surfaceVariant : 'transparent',
            })}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: a.danger ? `${colors.danger}1f` : colors.surfaceVariant }}>
              <Icon name={a.icon} size={20} color={a.danger ? colors.danger : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: fg }}>{a.label}</Text>
              {a.hint ? <Text style={{ color: colors.muted, fontSize: 12 }}>{a.hint}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
