import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, IconButton, Menu, Text } from 'react-native-paper';
import { uuid } from '../../lib/id';
import { getDestination } from '../../content/destinations';
import { dayCount, formatDay, parseDay, toDayString } from '../../lib/format';
import { typeTime } from '../../lib/timeInput';
import { deleteItineraryItem, listItinerary, upsertItineraryItem, type LocalItineraryItem, type LocalTrip } from '../../lib/localDb';
import { fetchForecast, weatherCodeIcon, weatherCodeLabel, type ForecastDay } from '../../lib/weather';
import { useAppTheme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { Meter } from '../../ui/Meter';
import { Sheet, SheetTextInput } from '../../ui/Sheet';
import { sortPlan, QUICK_TIMES } from './planRules';

/** readOnly: a crew member (not an admin) sees the plan but can't change it. */
type Props = { trip: LocalTrip; onChanged: () => void; readOnly?: boolean };

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function normalizeTime(t: string) {
  const m = TIME_RE.exec(t.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

export function PlanTab({ trip, onChanged, readOnly = false }: Props) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<LocalItineraryItem[]>([]);
  const [extraDays, setExtraDays] = useState(0);
  const [forecast, setForecast] = useState<Record<string, ForecastDay>>({});
  const [menuDay, setMenuDay] = useState<number | null>(null);
  // One sheet adds or edits a plan: which day, the plan being edited (null: a new one), the words, the time.
  const [sheet, setSheet] = useState<{ day: number; item: LocalItineraryItem | null } | null>(null);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const load = useCallback(async () => setItems(await listItinerary(trip.id)), [trip.id]);
  useEffect(() => {
    load();
  }, [load]);

  const lat = trip.dest_lat ?? getDestination(trip.place_key)?.lat;
  const lng = trip.dest_lng ?? getDestination(trip.place_key)?.lng;
  useEffect(() => {
    if (lat == null || lng == null || !trip.starts_on) return;
    const start = parseDay(trip.starts_on);
    if (!start || start.getTime() - Date.now() > 15 * 86400000) return;
    fetchForecast(lat, lng, 16).then(days => setForecast(Object.fromEntries(days.map(d => [d.date, d]))));
  }, [lat, lng, trip.starts_on]);

  const plannedDays = Math.max(dayCount(trip.starts_on, trip.ends_on), 1);
  const maxItemDay = items.reduce((m, i) => Math.max(m, i.day_index + 1), 0);
  const totalDays = Math.max(plannedDays, maxItemDay) + extraDays;

  const days = useMemo(
    () =>
      Array.from({ length: totalDays }, (_, i) => {
        const start = parseDay(trip.starts_on);
        const date = start ? toDayString(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)) : null;
        return { index: i, date, items: items.filter(it => it.day_index === i) };
      }),
    [totalDays, items, trip.starts_on]
  );

  const openAdd = (day: number) => {
    setTitle('');
    setTime('');
    setSheet({ day, item: null });
  };
  const openEdit = (item: LocalItineraryItem) => {
    setTitle(item.title);
    setTime(item.start_time ?? '');
    setSheet({ day: item.day_index, item });
  };

  /** Saves the sheet: a new plan on its day, or the changes to the one being edited. */
  const saveSheet = async () => {
    if (!sheet || !title.trim()) return;
    const t = time ? normalizeTime(time) : null;
    if (time && !t) {
      Alert.alert('Time format', 'Use 24-hour time like 06:30 or 18:00.');
      return;
    }
    const now = new Date().toISOString();
    if (sheet.item) {
      await upsertItineraryItem({ ...sheet.item, title: title.trim(), start_time: t, sync_status: 'pending', updated_at: now });
    } else {
      await upsertItineraryItem({
        id: uuid(),
        trip_id: trip.id,
        day_index: sheet.day,
        title: title.trim(),
        notes: null,
        start_time: t,
        place_name: null,
        done: 0,
        sort_order: items.filter(i => i.day_index === sheet.day).length,
        sync_status: 'pending',
        updated_at: now,
      });
    }
    setSheet(null);
    await load();
    onChanged();
  };

  const toggle = async (item: LocalItineraryItem) => {
    await upsertItineraryItem({ ...item, done: item.done ? 0 : 1, sync_status: 'pending', updated_at: new Date().toISOString() });
    await load();
    onChanged();
  };

  const remove = (item: LocalItineraryItem) =>
    Alert.alert('Remove from plan?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSheet(null);
          await deleteItineraryItem(item.id);
          await load();
          onChanged();
        },
      },
    ]);

  const clearDay = (day: { index: number; items: LocalItineraryItem[] }) => {
    setMenuDay(null);
    if (!day.items.length) return;
    Alert.alert(`Clear day ${day.index + 1}?`, `This removes ${day.items.length} plan${day.items.length === 1 ? '' : 's'} from this day.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear day',
        style: 'destructive',
        onPress: async () => {
          for (const it of day.items) await deleteItineraryItem(it.id);
          await load();
          onChanged();
        },
      },
    ]);
  };

  const removeExtraDay = () => {
    setMenuDay(null);
    setExtraDays(n => Math.max(0, n - 1));
  };

  const doneCount = items.filter(i => i.done).length;
  const today = toDayString(new Date());

  return (
    <View>
      {items.length ? (
        // How far along the plan is.
        <View style={{ padding: 14, borderRadius: 18, backgroundColor: colors.surfaceVariant, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '900' }}>{doneCount}</Text>
            <Text style={{ color: colors.muted, fontWeight: '600', flex: 1 }}> of {items.length} done</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{totalDays} {totalDays === 1 ? 'day' : 'days'}</Text>
          </View>
          <Meter progress={items.length ? doneCount / items.length : 0} color={colors.primary} />
        </View>
      ) : (
        <EmptyState
          compact
          icon="calendar-text-outline"
          title={readOnly ? 'No plan yet' : 'Plan each day'}
          body={readOnly ? 'When the owner or an admin plans the days, you will see them here.' : 'Add stops and timings for each day, then tick them off as you go. It works offline.'}
        />
      )}
      {days.map(day => {
        const f = day.date ? forecast[day.date] : undefined;
        const isToday = day.date === today;
        const list = sortPlan(day.items);
        return (
          <View key={day.index} style={{ marginBottom: 18 }}>
            {/* The day: its number and date, today's badge, the forecast, and its menu. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? colors.primary : colors.primaryContainer }}>
                <Text style={{ fontWeight: '900', color: isToday ? colors.onPrimary : colors.onPrimaryContainer }}>{day.index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: 16 }}>
                  Day {day.index + 1}
                  {isToday ? <Text style={{ color: colors.primary, fontSize: 13 }}>{'  · Today'}</Text> : null}
                </Text>
                {day.date ? <Text style={{ color: colors.muted, fontSize: 12 }}>{formatDay(day.date, { weekday: true })}</Text> : null}
              </View>
              {f ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surfaceVariant }} accessibilityLabel={`${weatherCodeLabel(f.code)}, ${Math.round(f.maxC ?? 0)} degrees`}>
                  <Icon name={weatherCodeIcon(f.code)} size={15} color={colors.secondary} />
                  <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                    {f.maxC != null ? `${Math.round(f.maxC)}°` : ''}
                    {f.precipChance ? ` · ${f.precipChance}%` : ''}
                  </Text>
                </View>
              ) : null}
              {readOnly ? null : (
                <Menu
                  visible={menuDay === day.index}
                  onDismiss={() => setMenuDay(null)}
                  anchor={<IconButton icon="dots-horizontal" size={20} style={{ margin: 0 }} onPress={() => setMenuDay(day.index)} accessibilityLabel={`Day ${day.index + 1} options`} />}
                >
                  <Menu.Item leadingIcon="broom" title="Clear this day" disabled={!day.items.length} onPress={() => clearDay(day)} />
                  {day.index >= plannedDays && day.index === totalDays - 1 && !day.items.length && extraDays > 0 ? (
                    <Menu.Item leadingIcon="delete-outline" title="Delete this day" onPress={removeExtraDay} />
                  ) : null}
                </Menu>
              )}
            </View>

            {/* Its plans along a thin line: time, a round tick, the plan. Tap a plan to change it. */}
            <View style={{ marginLeft: 19, paddingLeft: 21, borderLeftWidth: 2, borderLeftColor: isToday ? colors.primary : colors.border }}>
              {list.map(item => (
                <Pressable
                  key={item.id}
                  disabled={readOnly}
                  onPress={() => openEdit(item)}
                  onLongPress={() => remove(item)}
                  accessibilityRole={readOnly ? undefined : 'button'}
                  accessibilityLabel={`${item.start_time ? `${item.start_time}, ` : ''}${item.title}${item.done ? ', done' : ''}`}
                  accessibilityHint={readOnly ? undefined : 'Opens it to change or remove'}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderRadius: 12, paddingRight: 6, backgroundColor: pressed ? colors.surfaceVariant : 'transparent' })}
                >
                  <Pressable
                    onPress={() => toggle(item)}
                    disabled={readOnly}
                    hitSlop={10}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: Boolean(item.done) }}
                    accessibilityLabel={`Done: ${item.title}`}
                    style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: item.done ? colors.primary : colors.outline, backgroundColor: item.done ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {item.done ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
                  </Pressable>
                  <Text style={{ width: 46, fontWeight: '700', fontSize: 13, color: item.start_time ? colors.primary : colors.muted }}>{item.start_time ?? 'Any'}</Text>
                  <Text style={{ flex: 1, fontSize: 15, textDecorationLine: item.done ? 'line-through' : 'none', color: item.done ? colors.muted : colors.onSurface }}>{item.title}</Text>
                </Pressable>
              ))}
              {readOnly ? null : (
                <Pressable
                  onPress={() => openAdd(day.index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add a plan to day ${day.index + 1}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}
                >
                  <Icon name="plus-circle-outline" size={22} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Add a plan</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
      {readOnly ? null : (
        <Button mode="outlined" icon="calendar-plus" onPress={() => setExtraDays(n => n + 1)} style={{ alignSelf: 'center' }}>
          Add a day
        </Button>
      )}

      {/* Add or change a plan: what, when (or a quick time), and remove when editing. */}
      <Sheet visible={sheet !== null} onDismiss={() => setSheet(null)} title={sheet?.item ? 'Edit plan' : `Add to day ${(sheet?.day ?? 0) + 1}`}>
        <SheetTextInput mode="outlined" label="What" placeholder="Sunrise at Tiger Hill" value={title} onChangeText={setTitle} maxLength={200} autoFocus={!sheet?.item} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <SheetTextInput mode="outlined" label="Time" placeholder="06:30" value={time} onChangeText={t => setTime(typeTime(t))} maxLength={5} keyboardType="number-pad" style={{ width: 96 }} />
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_TIMES.map(q => (
              <Pressable
                key={q.time}
                onPress={() => setTime(time === q.time ? '' : q.time)}
                accessibilityRole="button"
                accessibilityState={{ selected: time === q.time }}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: time === q.time ? colors.primary : colors.surfaceVariant }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: time === q.time ? colors.onPrimary : colors.onSurfaceVariant }}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 8 }}>
          {sheet?.item ? (
            <Button textColor={colors.danger} icon="delete-outline" onPress={() => sheet.item && remove(sheet.item)}>
              Remove
            </Button>
          ) : null}
          <View style={{ flex: 1 }} />
          <Button mode="contained" disabled={!title.trim()} onPress={saveSheet} contentStyle={{ paddingHorizontal: 14, height: 44 }}>
            {sheet?.item ? 'Save' : 'Add plan'}
          </Button>
        </View>
      </Sheet>
    </View>
  );
}
