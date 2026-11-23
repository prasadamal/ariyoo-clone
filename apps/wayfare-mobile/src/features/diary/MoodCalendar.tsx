import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { monthGrid } from './moodCalendarRules';

type Written = { recorded_at: string; mood?: string | null };

/**
 * The diary's month at a glance: each day's mood emoji (or a dot when something was written).
 * Tap a day to open it. Replaces the plain date picker.
 */
export function MoodCalendar({ visible, onClose, entries, today, onPick }: { visible: boolean; onClose: () => void; entries: Written[]; today: string; onPick: (day: string) => void }) {
  const { colors } = useAppTheme();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const weeks = useMemo(() => monthGrid(cursor.y, cursor.m, entries, today), [cursor, entries, today]);
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const atLatest = cursor.y * 12 + cursor.m >= Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;
  const move = (k: number) => setCursor(c => { const t = c.y * 12 + c.m + k; return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; });
  const written = weeks.flat().filter(c => c.written).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: 16 }} onPress={onClose} accessibilityLabel="Close calendar">
        <Pressable onPress={() => undefined} style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton icon="chevron-left" onPress={() => move(-1)} accessibilityLabel="Previous month" style={{ margin: 0 }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', fontSize: 17 }}>{title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{written ? `${written} ${written === 1 ? 'day' : 'days'} written` : 'Nothing written yet'}</Text>
            </View>
            <IconButton icon="chevron-right" onPress={() => move(1)} disabled={atLatest} accessibilityLabel="Next month" style={{ margin: 0 }} />
          </View>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700' }}>{d}</Text>
            ))}
          </View>
          {weeks.map((w, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {w.map((c, ci) => {
                const isToday = c.day === today;
                return (
                  <Pressable
                    key={ci}
                    disabled={!c.day || c.future}
                    onPress={() => { if (c.day) { onPick(c.day); onClose(); } }}
                    accessibilityRole="button"
                    accessibilityLabel={c.day ? `${c.date}${c.written ? ', written' : ''}${c.emoji ? `, mood ${c.emoji}` : ''}` : undefined}
                    style={{ flex: 1, aspectRatio: 1, margin: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? colors.primaryContainer : c.written ? colors.surfaceVariant : 'transparent', opacity: c.future ? 0.35 : 1 }}
                  >
                    {c.date ? (
                      <>
                        <Text style={{ fontSize: 11, color: isToday ? colors.primary : colors.muted, fontWeight: isToday ? '800' : '500' }}>{c.date}</Text>
                        {c.emoji ? <Text style={{ fontSize: 16 }}>{c.emoji}</Text> : c.written ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.secondary, marginTop: 4 }} /> : null}
                      </>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
