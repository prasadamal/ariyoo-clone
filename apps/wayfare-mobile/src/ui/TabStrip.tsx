import { ScrollView } from 'react-native';
import { Pill } from './Pill';

export type TabItem<T extends string> = { value: T; label: string; icon?: string };

/** Horizontally scrolling pill tabs (fits 5–7 sections on small phones). */
export function TabStrip<T extends string>({ tabs, value, onChange }: { tabs: TabItem<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {tabs.map(t => (
        <Pill key={t.value} label={t.label} icon={t.icon} selected={value === t.value} onPress={() => onChange(t.value)} />
      ))}
    </ScrollView>
  );
}
