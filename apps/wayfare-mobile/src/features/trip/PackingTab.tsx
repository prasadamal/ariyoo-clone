import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Checkbox, IconButton, Menu, ProgressBar, Text, TextInput } from 'react-native-paper';
import {
  addPackingItem,
  copyPackingFrom,
  deletePackingItem,
  listPacking,
  listPackingSources,
  upsertPackingItem,
  type LocalPackingItem,
  type LocalTrip,
} from '../../lib/localDb';
import { useAppTheme } from '../../theme';

type Props = { trip: LocalTrip; onChanged: () => void };

export function PackingTab({ trip, onChanged }: Props) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<LocalPackingItem[]>([]);
  const [label, setLabel] = useState('');
  const [sources, setSources] = useState<{ id: string; title: string; items: number }[]>([]);
  const [picking, setPicking] = useState(false);
  const [copying, setCopying] = useState(false);
  // A ref, not state: two fast taps must not both copy before the first re-render.
  const copyBusy = useRef(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [list, past] = await Promise.all([listPacking(trip.id), listPackingSources(trip.id)]);
    setItems(list);
    setSources(past);
  }, [trip.id]);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (item: LocalPackingItem) => {
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, packed: i.packed ? 0 : 1 } : i)));
    await upsertPackingItem({ ...item, packed: item.packed ? 0 : 1, sync_status: 'pending', updated_at: new Date().toISOString() });
    onChanged();
  };

  const add = async () => {
    if (!label.trim()) return;
    await addPackingItem(trip.id, label);
    setLabel('');
    await load();
    onChanged();
  };

  const remove = (item: LocalPackingItem) =>
    Alert.alert('Remove item?', item.label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deletePackingItem(item.id);
          await load();
          onChanged();
        },
      },
    ]);

  const copyFrom = async (source: { id: string; title: string }) => {
    setPicking(false);
    if (copyBusy.current) return;
    copyBusy.current = true;
    setCopying(true);
    try {
      const added = await copyPackingFrom(source.id, trip.id);
      await load();
      onChanged();
      setNotice(added ? `Added ${added} ${added === 1 ? 'item' : 'items'} from “${source.title}”.` : `Everything from “${source.title}” is already on this list.`);
    } catch {
      setNotice('Could not copy that list. Please try again.');
    } finally {
      copyBusy.current = false;
      setCopying(false);
    }
  };

  const uncheckAll = async () => {
    const now = new Date().toISOString();
    for (const i of items.filter(x => x.packed)) await upsertPackingItem({ ...i, packed: 0, sync_status: 'pending', updated_at: now });
    await load();
    onChanged();
  };

  const packed = items.filter(i => i.packed).length;
  const progress = items.length ? packed / items.length : 0;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <ProgressBar progress={progress} color={colors.secondary} style={{ height: 8, borderRadius: 4, flex: 1 }} />
        <Text style={{ fontWeight: '700' }}>
          {packed}/{items.length}
        </Text>
      </View>
      {progress === 1 && items.length ? (
        <Text style={{ color: colors.success, fontWeight: '700', marginBottom: 8 }}>All packed — have a great trip! 🎒</Text>
      ) : null}
      {items.map(item => (
        <Pressable
          key={item.id}
          onPress={() => toggle(item)}
          onLongPress={() => remove(item)}
          style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!item.packed }}
        >
          <Checkbox.Android status={item.packed ? 'checked' : 'unchecked'} onPress={() => toggle(item)} />
          <Text style={{ flex: 1, paddingVertical: 12, textDecorationLine: item.packed ? 'line-through' : 'none', color: item.packed ? colors.muted : colors.onSurface }}>
            {item.label}
          </Text>
          <IconButton icon="close" size={16} onPress={() => remove(item)} accessibilityLabel={`Remove ${item.label}`} />
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <TextInput dense mode="outlined" placeholder="Add an item" value={label} onChangeText={setLabel} style={{ flex: 1 }} onSubmitEditing={add} returnKeyType="done" />
        <IconButton icon="plus-circle" iconColor={colors.primary} onPress={add} accessibilityLabel="Add packing item" />
      </View>
      {sources.length ? (
        <Menu
          visible={picking}
          onDismiss={() => setPicking(false)}
          anchor={
            <Button style={{ marginTop: 8 }} icon="content-copy" onPress={() => setPicking(true)} loading={copying} disabled={copying}>
              Copy from a past trip
            </Button>
          }
        >
          {sources.map(source => (
            <Menu.Item key={source.id} title={`${source.title} (${source.items})`} onPress={() => copyFrom(source)} />
          ))}
        </Menu>
      ) : null}
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, marginTop: 4 }}>
          {notice}
        </Text>
      ) : null}
      {packed ? (
        <Button style={{ marginTop: 8 }} icon="restore" onPress={uncheckAll}>
          Unpack all (reuse for the return)
        </Button>
      ) : null}
    </View>
  );
}
