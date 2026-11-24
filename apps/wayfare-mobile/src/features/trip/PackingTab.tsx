import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Checkbox, Dialog, IconButton, Menu, Portal, Text, TextInput } from 'react-native-paper';
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
  const [label, setLabel] = useState('');
  const [menu, setMenu] = useState(false);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
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
    if (!label.trim()) return;
    const next = addToList(current.items, label);
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

  const Row = ({ text, checked, onPress, onRemove }: { text: string; checked: boolean; onPress: () => void; onRemove?: () => void }) => (
    <Pressable onPress={onPress} onLongPress={onRemove} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Checkbox.Android status={checked ? 'checked' : 'unchecked'} onPress={onPress} />
      <Text style={{ flex: 1, paddingVertical: 12, textDecorationLine: checked ? 'line-through' : 'none', color: checked ? colors.muted : colors.onSurface }}>{text}</Text>
      {onRemove ? <IconButton icon="close" size={16} onPress={onRemove} accessibilityLabel={`Remove ${text}`} /> : null}
    </Pressable>
  );

  const tipNeeded = tip && !rows.some(r => labelKey(r.label) === labelKey(tip.item)) && !extras.some(e => labelKey(e.label) === labelKey(tip.item));

  return (
    <View>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
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
          {BUILT_IN_LISTS.includes(current.id) ? null : (
            <Menu.Item leadingIcon="delete-outline" title={`Delete “${current.name}”`} onPress={() => { setMenu(false); removeList(); }} />
          )}
        </Menu>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <TextInput dense mode="outlined" placeholder={`Add to ${current.name}`} value={label} onChangeText={setLabel} style={{ flex: 1 }} onSubmitEditing={add} returnKeyType="done" />
        <IconButton icon="plus-circle" iconColor={colors.primary} onPress={add} accessibilityLabel="Add packing item" style={{ margin: 0 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Meter progress={progress} color={colors.secondary} height={8} style={{ flex: 1 }} />
        <Text style={{ fontWeight: '700' }}>
          {packed}/{all.length}
        </Text>
      </View>
      {progress === 1 && all.length ? <Text style={{ color: colors.success, fontWeight: '700', marginBottom: 8 }}>All packed — have a great trip! 🎒</Text> : null}
      {rows.length ? null : <Text style={{ color: colors.muted, marginBottom: 6 }}>This checklist is empty. Add what you want to carry.</Text>}
      {rows.map(r => (
        <Row key={r.label} text={r.label} checked={r.packed} onPress={() => toggleLabel(r.label, r.item)} onRemove={() => removeFromChecklist(r.label)} />
      ))}
      {extras.length ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 16, letterSpacing: 0.4 }}>ALSO ON THIS JOURNEY</Text> : null}
      {extras.map(e => (
        <Row key={e.id} text={e.label} checked={Boolean(e.packed)} onPress={() => toggleLabel(e.label, e)} onRemove={() => removeExtra(e)} />
      ))}
      {packed ? (
        <Button style={{ marginTop: 8 }} icon="restore" onPress={uncheckAll}>
          Unpack all (reuse for the return)
        </Button>
      ) : null}
      <Portal>
        <Dialog visible={naming} onDismiss={() => setNaming(false)}>
          <Dialog.Title>New checklist</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Name (e.g. Trek, Wedding, Work)" value={newName} onChangeText={setNewName} maxLength={30} autoFocus onSubmitEditing={createList} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNaming(false)}>Cancel</Button>
            <Button mode="contained" disabled={!newName.trim()} onPress={createList}>
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
