import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { IconButton, Text, TextInput } from 'react-native-paper';
import { addToList, PACKING_LIST_IDS, PACKING_LIST_NAMES, removeFromList, type PackingListId, type PackingLists } from '../src/lib/packingLists';
import { loadPackingLists, savePackingLists } from '../src/lib/packingListsStore';
import { useToast } from '../src/context/ToastContext';
import { useAppTheme } from '../src/theme';
import { FloatingTabs } from '../src/ui/FloatingTabs';
import { Icon } from '../src/ui/Icon';
import { Screen } from '../src/ui/Screen';

/**
 * Your packing lists: the personal things you carry, kept as a short-trip list, a long-trip list and
 * one of your own. Each journey's Pack tab ticks them off. Saved on this phone.
 */
export default function PackingListsScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [lists, setLists] = useState<PackingLists | null>(null);
  const [tab, setTab] = useState<PackingListId>('short');
  const [label, setLabel] = useState('');
  // Writes go one at a time so two quick edits can't overwrite each other.
  const latest = useRef<PackingLists | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadPackingLists().then(l => { latest.current = l; setLists(l); }).catch(() => toast('Could not open your lists'));
    }, [toast])
  );

  const update = async (next: PackingLists) => {
    latest.current = next;
    setLists(next);
    try { await savePackingLists(next); } catch { toast('Could not save. Try again.'); }
  };

  if (!lists) return <Screen><Text style={{ color: colors.muted }}>Opening your lists…</Text></Screen>;
  const items = lists[tab];

  const add = () => {
    const base = latest.current ?? lists;
    const next = addToList(base[tab], label);
    if (next.length === base[tab].length) { if (label.trim()) toast('Already on this list'); return; }
    setLabel('');
    void update({ ...base, [tab]: next });
  };

  const remove = (item: string) =>
    Alert.alert('Remove from list?', item, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { const base = latest.current ?? lists; void update({ ...base, [tab]: removeFromList(base[tab], item) }); } },
    ]);

  return (
    <Screen>
      <FloatingTabs
        accessibilityLabel="Packing lists"
        tabs={PACKING_LIST_IDS.map(id => ({ value: id, label: PACKING_LIST_NAMES[id] }))}
        value={tab}
        onChange={setTab}
        style={{ alignSelf: 'center', marginBottom: 18 }}
      />
      <Text style={{ color: colors.muted, marginBottom: 10 }}>
        {items.length} {items.length === 1 ? 'thing' : 'things'} to carry · tick them off in each journey’s Pack tab
      </Text>
      <View style={{ backgroundColor: colors.surfaceVariant, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4 }}>
        {items.length ? (
          items.map((item, i) => (
            <Pressable
              key={item}
              onLongPress={() => remove(item)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: colors.border }}
            >
              <Icon name="bag-personal-outline" size={18} color={colors.primary} />
              <Text style={{ flex: 1, paddingVertical: 13 }}>{item}</Text>
              <IconButton icon="close" size={16} onPress={() => remove(item)} accessibilityLabel={`Remove ${item}`} style={{ margin: 0 }} />
            </Pressable>
          ))
        ) : (
          <Text style={{ color: colors.muted, paddingVertical: 16 }}>Nothing here yet. Add the things you always carry.</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
        <TextInput dense mode="outlined" placeholder={`Add to ${PACKING_LIST_NAMES[tab].toLowerCase()}`} value={label} onChangeText={setLabel} onSubmitEditing={add} returnKeyType="done" style={{ flex: 1 }} />
        <IconButton icon="plus-circle" iconColor={colors.primary} size={30} onPress={add} accessibilityLabel="Add item" />
      </View>
    </Screen>
  );
}
