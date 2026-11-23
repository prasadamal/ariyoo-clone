import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../theme';

export type FloatingTab<T extends string> = { value: T; label: string; leading?: string };

/**
 * A floating segmented toggle: a raised rounded tray with one pill per option; the chosen pill is
 * filled with the brand colour. Scrolls sideways when there are many options (countries).
 */
export function FloatingTabs<T extends string>({
  tabs,
  value,
  onChange,
  style,
  accessibilityLabel,
}: {
  tabs: FloatingTab<T>[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          alignSelf: 'flex-start',
          maxWidth: '100%',
          borderRadius: 999,
          backgroundColor: colors.surface,
          padding: 4,
          shadowColor: colors.primary,
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 5,
        },
        style,
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
        {tabs.map(t => {
          const on = t.value === value;
          return (
            <Pressable
              key={t.value}
              onPress={() => onChange(t.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: on ? colors.primary : 'transparent',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {t.leading ? <Text style={{ fontSize: 15 }}>{t.leading}</Text> : null}
              <Text style={{ fontWeight: '800', fontSize: 13, color: on ? colors.onPrimary : colors.onSurfaceVariant }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
