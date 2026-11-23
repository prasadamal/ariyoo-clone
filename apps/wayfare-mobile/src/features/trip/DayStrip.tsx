import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { DayCell } from './dayStripCells';

const CELL_W = 56;
const GAP = 6;

/**
 * A minimal sideways day scroller for a journey: "DAY 1" over the date and weekday; the chosen day
 * sits in a brand-coloured pill; an orange dot marks days with moments. Swipe or tap — no arrows.
 */
export function DayStrip({ cells, selected, onSelect }: { cells: DayCell[]; selected: string | null; onSelect: (cell: DayCell) => void }) {
  const { colors } = useAppTheme();
  const ref = useRef<ScrollView>(null);
  const index = cells.findIndex(c => c.day === selected && c.kind === 'day');

  // Keep the chosen day in view (centred when possible).
  useEffect(() => {
    if (index < 0) return;
    const t = setTimeout(() => ref.current?.scrollTo({ x: Math.max(0, index * (CELL_W + GAP) - CELL_W * 2), animated: true }), 50);
    return () => clearTimeout(t);
  }, [index]);

  return (
    // A fixed height keeps this horizontal list from stretching inside the scrolling page on Android.
    <View style={{ height: 78, marginBottom: 12 }}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: GAP, alignItems: 'center', paddingHorizontal: 2 }}
        accessibilityRole="tablist"
        accessibilityLabel="Days of this journey"
      >
        {cells.map(c => {
          const on = c.day === selected && (c.kind === 'day' || cells.findIndex(x => x.day === c.day && x.kind === 'day') < 0);
          const date = new Date(`${c.day}T12:00:00`);
          const top = c.kind === 'day' ? `DAY ${c.n}` : c.kind === 'before' ? 'BEFORE' : 'AFTER';
          const label =
            c.kind === 'day'
              ? `Day ${c.n}, ${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${c.hasMoments ? '' : ', no moments yet'}`
              : c.kind === 'before'
                ? 'Moments before the trip'
                : 'Moments after the trip';
          return (
            <Pressable
              key={`${c.kind}-${c.day}`}
              onPress={() => onSelect(c)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              style={({ pressed }) => ({
                width: CELL_W,
                height: 72,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? colors.primary : colors.surfaceVariant,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: on ? colors.onPrimary : colors.muted }}>{top}</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', lineHeight: 24, color: on ? colors.onPrimary : colors.onSurface }}>
                {c.kind === 'day' ? date.getDate() : '•••'}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: on ? colors.onPrimary : colors.muted }}>
                {c.kind === 'day' ? date.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase() : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
              <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 3, backgroundColor: c.hasMoments ? (on ? colors.onPrimary : colors.secondary) : 'transparent' }} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
