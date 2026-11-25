import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, IconButton, Menu, Text, TextInput } from 'react-native-paper';
import { uuid } from '../../lib/id';
import { addPackingItem, deletePackingItem, listPacking, upsertPackingItem, type LocalPackingItem, type LocalTrip } from '../../lib/localDb';
import {
  addList,
  addToList,
  BUILT_IN_LISTS,
  defaultListFor,
  deleteList,
  labelKey,
  listOrDefault,
  packView,
  removeFromList,
  updateItems,
  type PackingLists,
} from '../../lib/packingLists';
import { loadPackingLists, loadTripList, savePackingLists, saveTripList } from '../../lib/packingListsStore';
import { useAppTheme } from '../../theme';
import { FloatingTabs } from '../../ui/FloatingTabs';
import { Meter } from '../../ui/Meter';
import { Icon } from '../../ui/Icon';
import { Sheet, SheetTextInput } from '../../ui/Sheet';
import { getDestination } from '../../content/destinations';
import { tripForecast, weatherTip, type WeatherTip } from '../../lib/packingNudges';
import { fetchForecast } from '../../lib/weather';

type Props = { trip: LocalTrip; onChanged: () => void };

const TIP_ICONS: Record<string, string> = { 'Rain jacket': 'weather-pouring', 'Warm gloves': 'snowflake', 'Warm layer': 'thermometer-low', Sunscreen: 'white-balance-sunny' };

/**
 * Pack for this journey from one of your checklists (Short trip, Long trip, or your own). Ticks are
 * saved per journey; items you add or remove here change the checklist for next time too. New
 * checklists are made here (⋯ menu).
 */
export function PackingTab({ trip, onChanged }: Props) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<LocalPackingItem[]>([]);
  const [lists, setLists] = useState<PackingLists | null>(null);
  const [selected, setSelected] = useState<string>(defaultListFor(trip.starts_on, trip.ends_on));
  const [label, setLabelState] = useState('');
  // The box's words as typed, read by Enter (which can fire before the screen redraws).
  const labelNow = useRef('');
  const setLabel = (t: string) => {
    labelNow.current = t;
    setLabelState(t);
  };
  const [menu, setMenu] = useState(false);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [showPacked, setShowPacked] = useState(false);
  // One thing to pack from the trip's forecast (rain jacket, warm layer…), unless skipped.
  const [tip, setTip] = useState<WeatherTip | null>(null);
  const tipKey = `wayfare_pack_tip_skip_${trip.id}`;
  useEffect(() => {
    const lat = trip.dest_lat ?? getDestination(trip.place_key)?.lat;
    const lng = trip.dest_lng ?? getDestination(trip.place_key)?.lng;
    if (lat == null || lng == null || !trip.starts_on) return;
    const days = (new Date(`${trip.starts_on}T00:00:00`).getTime() - Date.now()) / 86400000;
    if (days > 15 || days < -1) return; // the forecast reaches ~16 days ahead; past trips don't need it
    let alive = true;
    Promise.all([fetchForecast(lat, lng, 16), AsyncStorage.getItem(tipKey).catch(() => null)])
      .then(([forecast, skipped]) => {
        const t = weatherTip(tripForecast(forecast, trip.starts_on!, trip.ends_on));
        if (alive) setTip(t && t.item !== skipped ? t : null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [trip.dest_lat, trip.dest_lng, trip.place_key, trip.starts_on, trip.ends_on, tipKey]);

  // Labels being saved right now: a second tap can't create the same item twice.
  const busy = useRef(new Set<string>());

  const load = useCallback(async () => {
    const [list, personal, chosen] = await Promise.all([listPacking(trip.id), loadPackingLists(), loadTripList(trip.id)]);
    setItems(list);
    setLists(personal);
    if (chosen) setSelected(chosen);
  }, [trip.id]);
  useEffect(() => {
    load();
  }, [load]);

  const saveLists = async (next: PackingLists) => {
    setLists(next);
    await savePackingLists(next).catch(() => undefined);
  };

  const choose = (id: string) => {
    setSelected(id);
    void saveTripList(trip.id, id);
  };

  const toggleLabel = async (rowLabel: string, item: LocalPackingItem | null) => {
    const k = labelKey(rowLabel);
    if (busy.current.has(k)) return;
    busy.current.add(k);
    try {
      if (item) {
        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, packed: i.packed ? 0 : 1 } : i)));
        await upsertPackingItem({ ...item, packed: item.packed ? 0 : 1, sync_status: 'pending', updated_at: new Date().toISOString() });
      } else {
        await addPackingItem(trip.id, rowLabel, 1);
      }
      setItems(await listPacking(trip.id));
      onChanged();
    } finally {
      busy.current.delete(k);
    }
  };

  if (!lists) return null;
  const current = listOrDefault(lists, selected);

  const add = async () => {
    const text = labelNow.current;
    if (!text.trim()) return;
    const next = addToList(current.items, text);
    setLabel('');
    if (next.length !== current.items.length) await saveLists(updateItems(lists, current.id, next));
  };

  const removeFromChecklist = (item: string) =>
    Alert.alert(`Remove from “${current.name}”?`, item, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void saveLists(updateItems(lists, current.id, removeFromList(current.items, item))) },
    ]);

  const removeExtra = (item: LocalPackingItem) =>
    Alert.alert('Remove item?', item.label, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deletePackingItem(item.id); await load(); onChanged(); } },
    ]);

  const createList = async () => {
    const id = `list-${uuid().slice(0, 8)}`;
    const next = addList(lists, newName, id);
    setNaming(false);
    setNewName('');
    if (next !== lists) {
      await saveLists(next);
      choose(id);
    }
  };

  const removeList = () =>
    Alert.alert(`Delete “${current.name}”?`, 'The checklist is removed for every journey. Ticks already made on journeys stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void saveLists(deleteList(lists, current.id)); choose('short'); } },
    ]);

  const uncheckAll = async () => {
    const now = new Date().toISOString();
    for (const i of items.filter(x => x.packed)) await upsertPackingItem({ ...i, packed: 0, sync_status: 'pending', updated_at: now });
    await load();
    onChanged();
  };

  const { rows, extras } = packView(lists, current.id, items);
  const all = [...rows.map(r => r.packed), ...extras.map(e => Boolean(e.packed))];
  const packed = all.filter(Boolean).length;
  const progress = all.length ? packed / all.length : 0;

  // A row: a big round tick and the item. Tap to pack or unpack; long-press to remove.
  const Row = ({ text, checked, onPress, onRemove }: { text: string; checked: boolean; onPress: () => void; onRemove?: () => void }) => (
    <Pressable
      onPress={onPress}
      onLongPress={onRemove}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityHint={onRemove ? 'Long-press to remove' : undefined}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 6, borderRadius: 14, backgroundColor: pressed ? colors.surfaceVariant : 'transparent' })}
    >
      <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: checked ? colors.secondary : colors.outline, backgroundColor: checked ? colors.secondary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {checked ? <Icon name="check" size={16} color="#fff" /> : null}
      </View>
      <Text style={{ flex: 1, fontSize: 16, textDecorationLine: checked ? 'line-through' : 'none', color: checked ? colors.muted : colors.onSurface }}>{text}</Text>
    </Pressable>
  );

  const tipNeeded = tip && !rows.some(r => labelKey(r.label) === labelKey(tip.item)) && !extras.some(e => labelKey(e.label) === labelKey(tip.item));
  // Still to pack on top; packed things fold away underneath.
  const todo = [
    ...rows.filter(r => !r.packed).map(r => ({ key: `l-${r.label}`, text: r.label, checked: false, press: () => toggleLabel(r.label, r.item), remove: () => removeFromChecklist(r.label) })),
    ...extras.filter(e => !e.packed).map(e => ({ key: e.id, text: e.label, checked: false, press: () => toggleLabel(e.label, e), remove: () => removeExtra(e) })),
  ];
  const done = [
    ...rows.filter(r => r.packed).map(r => ({ key: `l-${r.label}`, text: r.label, checked: true, press: () => toggleLabel(r.label, r.item), remove: () => removeFromChecklist(r.label) })),
    ...extras.filter(e => e.packed).map(e => ({ key: e.id, text: e.label, checked: true, press: () => toggleLabel(e.label, e), remove: () => removeExtra(e) })),
  ];

  return (
    <View>
      {/* How much is packed, and which checklist this journey uses. */}
      <View style={{ padding: 14, borderRadius: 18, backgroundColor: colors.surfaceVariant, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }} accessible accessibilityLabel={`${packed} of ${all.length} packed`}>
          <Text style={{ fontSize: 22, fontWeight: '900' }}>{packed}</Text>
          <Text style={{ color: colors.muted, fontWeight: '600', flex: 1 }}> of {all.length} packed</Text>
          {progress === 1 && all.length ? <Text style={{ color: colors.success, fontWeight: '800' }}>All packed 🎒</Text> : null}
        </View>
        <Meter accessibilityLabel={`Packed: ${Math.round(progress * 100)} percent`} progress={progress} color={colors.secondary} height={8} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <FloatingTabs
              accessibilityLabel="Packing checklist for this journey"
              tabs={lists.map(l => ({ value: l.id, label: l.name }))}
              value={current.id}
              onChange={choose}
            />
          </View>
          <Menu
            visible={menu}
            onDismiss={() => setMenu(false)}
            anchor={<IconButton icon="dots-horizontal" onPress={() => setMenu(true)} accessibilityLabel="Checklist options" style={{ margin: 0 }} />}
          >
            <Menu.Item leadingIcon="playlist-plus" title="New checklist" onPress={() => { setMenu(false); setNaming(true); }} />
            {packed ? <Menu.Item leadingIcon="restore" title="Unpack all (for the return)" onPress={() => { setMenu(false); void uncheckAll(); }} /> : null}
            {BUILT_IN_LISTS.includes(current.id) ? null : (
              <Menu.Item leadingIcon="delete-outline" title={`Delete “${current.name}”`} onPress={() => { setMenu(false); removeList(); }} />
            )}
          </Menu>
        </View>
      </View>

      {tipNeeded ? (
        // From the forecast: one suggestion, added to this checklist with a tap.
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.primaryContainer, marginBottom: 12 }}>
          <Icon name={TIP_ICONS[tip.item] ?? 'weather-partly-cloudy'} size={22} color={colors.onPrimaryContainer} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.onPrimaryContainer }}>Add a {tip.item.toLowerCase()}?</Text>
            <Text style={{ fontSize: 12, color: colors.onPrimaryContainer }}>{tip.why}</Text>
          </View>
          <Button compact mode="contained" onPress={() => void saveLists(updateItems(lists, current.id, addToList(current.items, tip.item)))}>
            Add
          </Button>
          <IconButton
            icon="close"
            size={16}
            accessibilityLabel="Skip this suggestion"
            onPress={() => {
              AsyncStorage.setItem(tipKey, tip.item).catch(() => undefined);
              setTip(null);
            }}
          />
        </View>
      ) : null}

      {!all.length ? <Text style={{ color: colors.muted, marginBottom: 6 }}>This checklist is empty. Add what you want to carry.</Text> : null}
      {todo.map(r => (
        <Row key={r.key} text={r.text} checked={false} onPress={r.press} onRemove={r.remove} />
      ))}
      {all.length && !todo.length ? <Text style={{ color: colors.muted, paddingVertical: 8, paddingHorizontal: 6 }}>Nothing left to pack.</Text> : null}

      {/* Add an item: it joins this checklist for next time too. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <TextInput dense mode="outlined" placeholder={`Add to ${current.name}`} value={label} onChangeText={setLabel} style={{ flex: 1 }} onSubmitEditing={add} returnKeyType="done" />
        {label.trim() ? <Button mode="contained" compact onPress={add}>Add</Button> : null}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6, marginLeft: 4 }}>Tap to pack · long-press to remove</Text>

      {done.length ? (
        <View style={{ marginTop: 18 }}>
          <Pressable onPress={() => setShowPacked(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: showPacked }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 0.6, color: colors.onSurfaceVariant, flex: 1 }}>PACKED · {done.length}</Text>
            <Icon name={showPacked ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
          </Pressable>
          {showPacked ? done.map(r => <Row key={r.key} text={r.text} checked onPress={r.press} onRemove={r.remove} />) : null}
        </View>
      ) : null}

      <Sheet visible={naming} onDismiss={() => setNaming(false)} title="New checklist" subtitle="Reuse it on any journey, like Trek, Wedding or Work.">
        <SheetTextInput mode="outlined" label="Name" value={newName} onChangeText={setNewName} maxLength={30} autoFocus onSubmitEditing={createList} />
        <Button mode="contained" disabled={!newName.trim()} onPress={createList} style={{ marginTop: 14 }} contentStyle={{ height: 46 }}>
          Create checklist
        </Button>
      </Sheet>
    </View>
  );
}
