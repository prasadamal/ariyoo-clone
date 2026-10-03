import { useState } from 'react';
import { View } from 'react-native';
import { Button, Checkbox, IconButton, ProgressBar, Text, TextInput, useTheme } from 'react-native-paper';
import { newId } from '../../lib/id';
import { deletePackingItem, upsertPackingItem, type LocalPackingItem } from '../../lib/localDb';
import { LIMITS } from '../../lib/validation';

export function PackingSection({ tripId, items, onChanged }: { tripId: string; items: LocalPackingItem[]; onChanged: () => void }) {
  const theme = useTheme();
  const [label, setLabel] = useState('');
  const done = items.filter(i => i.packed).length;

  const toggle = async (item: LocalPackingItem) => {
    await upsertPackingItem({ ...item, packed: item.packed ? 0 : 1, sync_status: 'pending', updated_at: new Date().toISOString() });
    onChanged();
  };

  const add = async () => {
    const text = label.trim();
    if (!text) return;
    await upsertPackingItem({
      id: newId(),
      trip_id: tripId,
      label: text,
      packed: 0,
      sort_order: items.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    });
    setLabel('');
    onChanged();
  };

  const remove = async (item: LocalPackingItem) => {
    await deletePackingItem(item.id);
    onChanged();
  };

  return (
    <View>
      {items.length ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}>{done} of {items.length} packed</Text>
          <ProgressBar progress={items.length ? done / items.length : 0} color={theme.colors.secondary} style={{ height: 6, borderRadius: 3 }} />
        </View>
      ) : (
        <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>Your packing list is empty. Add what you need below.</Text>
      )}
      {items.map(item => (
        <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Checkbox.Item
              label={item.label}
              status={item.packed ? 'checked' : 'unchecked'}
              onPress={() => toggle(item)}
              position="leading"
              labelStyle={{ textAlign: 'left', textDecorationLine: item.packed ? 'line-through' : 'none' }}
              accessibilityLabel={`${item.label}, ${item.packed ? 'packed' : 'not packed'}`}
            />
          </View>
          <IconButton icon="close" size={18} onPress={() => remove(item)} accessibilityLabel={`Remove ${item.label}`} />
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <TextInput label="Add item" value={label} onChangeText={setLabel} mode="outlined" style={{ flex: 1 }} maxLength={LIMITS.label} onSubmitEditing={add} returnKeyType="done" />
        <Button mode="contained" onPress={add} disabled={!label.trim()}>Add</Button>
      </View>
    </View>
  );
}
