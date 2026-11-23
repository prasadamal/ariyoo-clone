import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Checkbox, IconButton, Text, TextInput } from 'react-native-paper';
import { addPackingItem, deletePackingItem, listPacking, upsertPackingItem, type LocalPackingItem, type LocalTrip } from '../../lib/localDb';
import { addToList, defaultListFor, labelKey, PACKING_LIST_IDS, PACKING_LIST_NAMES, packView, type PackingListId, type PackingLists } from '../../lib/packingLists';
import { loadPackingLists, loadTripList, savePackingLists, saveTripList } from '../../lib/packingListsStore';
import { useAppTheme } from '../../theme';
import { FloatingTabs } from '../../ui/FloatingTabs';
import { Meter } from '../../ui/Meter';

type Props = { trip: LocalTrip; onChanged: () => void };

/**
 * Pack for this journey from one of your personal lists (short trip, long trip, custom). Ticks are
 * saved per journey; items you add here go onto the chosen list for next time too.
 */
export function PackingTab({ trip, onChanged }: Props) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<LocalPackingItem[]>([]);
  const [lists, setLists] = useState<PackingLists | null>(null);
  const [selected, setSelected] = useState<PackingListId>(defaultListFor(trip.starts_on, trip.ends_on));
  const [label, setLabel] = useState('');
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

  const choose = (id: PackingListId) => {
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

  const add = async () => {
    if (!lists || !label.trim()) return;
    const next = addToList(lists[selected], label);
    setLabel('');
    if (next.length === lists[selected].length) return;
    const updated = { ...lists, [selected]: next };
    setLists(updated);
    await savePackingLists(updated).catch(() => undefined);
  };

  const removeExtra = (item: LocalPackingItem) =>
    Alert.alert('Remove item?', item.label, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deletePackingItem(item.id); await load(); onChanged(); } },
    ]);

  const uncheckAll = async () => {
    const now = new Date().toISOString();
    for (const i of items.filter(x => x.packed)) await upsertPackingItem({ ...i, packed: 0, sync_status: 'pending', updated_at: now });
    await load();
    onChanged();
  };

  if (!lists) return null;
  const { rows, extras } = packView(lists, selected, items);
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

  return (
    <View>
      <FloatingTabs
        accessibilityLabel="Packing list for this journey"
        tabs={PACKING_LIST_IDS.map(id => ({ value: id, label: PACKING_LIST_NAMES[id] }))}
        value={selected}
        onChange={choose}
        style={{ alignSelf: 'center', marginBottom: 12 }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <TextInput dense mode="outlined" placeholder={`Add to ${PACKING_LIST_NAMES[selected].toLowerCase()} list`} value={label} onChangeText={setLabel} style={{ flex: 1 }} onSubmitEditing={add} returnKeyType="done" />
        <IconButton icon="plus-circle" iconColor={colors.primary} onPress={add} accessibilityLabel="Add packing item" style={{ margin: 0 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Meter progress={progress} color={colors.secondary} height={8} style={{ flex: 1 }} />
        <Text style={{ fontWeight: '700' }}>
          {packed}/{all.length}
        </Text>
      </View>
      {progress === 1 && all.length ? <Text style={{ color: colors.success, fontWeight: '700', marginBottom: 8 }}>All packed — have a great trip! 🎒</Text> : null}
      {rows.length ? null : <Text style={{ color: colors.muted, marginBottom: 6 }}>This list is empty. Add what you want to carry.</Text>}
      {rows.map(r => (
        <Row key={r.label} text={r.label} checked={r.packed} onPress={() => toggleLabel(r.label, r.item)} />
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
    </View>
  );
}
