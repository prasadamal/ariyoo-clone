import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Checkbox, Dialog, IconButton, Menu, Portal, Text, TextInput } from 'react-native-paper';
import { uuid } from '../../lib/id';
import { getDestination } from '../../content/destinations';
import { dayCount, formatDay, parseDay, toDayString } from '../../lib/format';
import { deleteItineraryItem, listItinerary, upsertItineraryItem, type LocalItineraryItem, type LocalTrip } from '../../lib/localDb';
import { fetchForecast, weatherCodeIcon, weatherCodeLabel, type ForecastDay } from '../../lib/weather';
import { useAppTheme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';

type Props = { trip: LocalTrip; onChanged: () => void };

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function normalizeTime(t: string) {
  const m = TIME_RE.exec(t.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

export function PlanTab({ trip, onChanged }: Props) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<LocalItineraryItem[]>([]);
  const [extraDays, setExtraDays] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, { title: string; time: string }>>({});
  const [forecast, setForecast] = useState<Record<string, ForecastDay>>({});
  const [menuDay, setMenuDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<LocalItineraryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTime, setEditTime] = useState('');

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

  const add = async (day: number) => {
    const d = drafts[day];
    if (!d?.title.trim()) return;
    const time = d.time ? normalizeTime(d.time) : null;
    if (d.time && !time) {
      Alert.alert('Time format', 'Use 24-hour time like 06:30 or 18:00.');
      return;
    }
    await upsertItineraryItem({
      id: uuid(),
      trip_id: trip.id,
      day_index: day,
      title: d.title.trim(),
      notes: null,
      start_time: time,
      place_name: null,
      done: 0,
      sort_order: items.filter(i => i.day_index === day).length,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    });
    setDrafts(prev => ({ ...prev, [day]: { title: '', time: '' } }));
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
          await deleteItineraryItem(item.id);
          await load();
          onChanged();
        },
      },
    ]);

  const startEdit = (item: LocalItineraryItem) => {
    setEditing(item);
    setEditTitle(item.title);
    setEditTime(item.start_time ?? '');
  };

  const saveEdit = async () => {
    if (!editing || !editTitle.trim()) return;
    const time = editTime ? normalizeTime(editTime) : null;
    if (editTime && !time) {
      Alert.alert('Time format', 'Use 24-hour time like 06:30 or 18:00.');
      return;
    }
    await upsertItineraryItem({ ...editing, title: editTitle.trim(), start_time: time, sync_status: 'pending', updated_at: new Date().toISOString() });
    setEditing(null);
    await load();
    onChanged();
  };

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

  return (
    <View>
      {items.length ? (
        <Text style={{ color: colors.muted, marginBottom: 10 }}>
          {doneCount}/{items.length} planned stops done
        </Text>
      ) : (
        <EmptyState compact icon="calendar-text-outline" title="Plan each day" body="Add stops, timings and ideas per day. Tick them off as you go — it works offline." />
      )}
      {days.map(day => {
        const f = day.date ? forecast[day.date] : undefined;
        const draft = drafts[day.index] ?? { title: '', time: '' };
        return (
          <View key={day.index} style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontWeight: '800', flex: 1 }}>
                Day {day.index + 1}
                {day.date ? <Text style={{ color: colors.muted, fontWeight: '400' }}> · {formatDay(day.date, { weekday: true })}</Text> : null}
              </Text>
              {f ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel={`${weatherCodeLabel(f.code)}, ${Math.round(f.maxC ?? 0)} degrees`}>
                  <Icon name={weatherCodeIcon(f.code)} size={16} color={colors.secondary} />
                  <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                    {f.maxC != null ? `${Math.round(f.maxC)}°` : ''}/{f.minC != null ? `${Math.round(f.minC)}°` : ''}
                    {f.precipChance ? ` · ${f.precipChance}%` : ''}
                  </Text>
                </View>
              ) : null}
              <Menu
                visible={menuDay === day.index}
                onDismiss={() => setMenuDay(null)}
                anchor={<IconButton icon="dots-vertical" size={18} style={{ margin: 0 }} onPress={() => setMenuDay(day.index)} accessibilityLabel={`Day ${day.index + 1} options`} />}
              >
                <Menu.Item leadingIcon="broom" title="Clear this day" disabled={!day.items.length} onPress={() => clearDay(day)} />
                {day.index >= plannedDays && day.index === totalDays - 1 && !day.items.length && extraDays > 0 ? (
                  <Menu.Item leadingIcon="delete-outline" title="Delete this day" onPress={removeExtraDay} />
                ) : null}
              </Menu>
            </View>
            {day.items.map(item => (
              <Pressable key={item.id} onPress={() => startEdit(item)} onLongPress={() => remove(item)} accessibilityLabel={`Edit ${item.title}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Checkbox.Android status={item.done ? 'checked' : 'unchecked'} onPress={() => toggle(item)} />
                <View style={{ flex: 1 }}>
                  <Text style={{ textDecorationLine: item.done ? 'line-through' : 'none', color: item.done ? colors.muted : colors.onSurface }}>
                    {item.start_time ? <Text style={{ fontWeight: '700', color: colors.primary }}>{item.start_time} </Text> : null}
                    {item.title}
                  </Text>
                </View>
                <IconButton icon="pencil-outline" size={16} onPress={() => startEdit(item)} accessibilityLabel={`Edit ${item.title}`} />
                <IconButton icon="delete-outline" size={18} onPress={() => remove(item)} accessibilityLabel={`Remove ${item.title}`} />
              </Pressable>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <TextInput
                dense
                mode="outlined"
                placeholder="06:30"
                value={draft.time}
                onChangeText={t => setDrafts(prev => ({ ...prev, [day.index]: { ...draft, time: t } }))}
                style={{ width: 76 }}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <TextInput
                dense
                mode="outlined"
                placeholder="Add a stop or plan…"
                value={draft.title}
                onChangeText={t => setDrafts(prev => ({ ...prev, [day.index]: { ...draft, title: t } }))}
                style={{ flex: 1 }}
                maxLength={200}
                onSubmitEditing={() => add(day.index)}
                returnKeyType="done"
              />
              <IconButton icon="plus-circle" iconColor={colors.primary} onPress={() => add(day.index)} accessibilityLabel={`Add to day ${day.index + 1}`} />
            </View>
          </View>
        );
      })}
      <Button icon="calendar-plus" onPress={() => setExtraDays(n => n + 1)}>
        Add a day
      </Button>
      <Portal>
        <Dialog visible={editing !== null} onDismiss={() => setEditing(null)}>
          <Dialog.Title>Edit plan</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="What" value={editTitle} onChangeText={setEditTitle} maxLength={200} autoFocus />
            <View style={{ height: 10 }} />
            <TextInput mode="outlined" label="Time (24-hour, optional)" placeholder="06:30" value={editTime} onChangeText={setEditTime} maxLength={5} keyboardType="numbers-and-punctuation" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditing(null)}>Cancel</Button>
            <Button mode="contained" disabled={!editTitle.trim()} onPress={saveEdit}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
