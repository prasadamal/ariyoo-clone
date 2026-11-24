import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Pill } from './Pill';

export type TabItem<T extends string> = { value: T; label: string; icon?: string };

/** Horizontally scrolling pill tabs (fits 5–7 sections on small phones). */
export function TabStrip<T extends string>({ tabs, value, onChange }: { tabs: TabItem<T>[]; value: T; onChange: (v: T) => void }) {
  // Narrow phones (under ~380 pt) drop the icons so every tab fits without scrolling.
  const { width } = useWindowDimensions();
  const compact = width < 380;
  return (
    // A fixed height keeps the sideways row from stretching inside the page on Android.
    <View style={{ height: 34 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: compact ? 6 : 8, paddingVertical: 4 }}>
        {tabs.map(t => (
          <Pill key={t.value} label={t.label} icon={compact ? undefined : t.icon} selected={value === t.value} onPress={() => onChange(t.value)} />
        ))}
      </ScrollView>
    </View>
  );
}
