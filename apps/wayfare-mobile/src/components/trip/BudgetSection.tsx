import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Chip, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { newId } from '../../lib/id';
import { deleteExpense, upsertExpense, type LocalExpense } from '../../lib/localDb';
import { LIMITS, parseAmount } from '../../lib/validation';

const CATEGORIES = ['food', 'stay', 'transport', 'gear', 'permit', 'other'];

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function BudgetSection({ tripId, expenses, onChanged }: { tripId: string; expenses: LocalExpense[]; onChanged: () => void }) {
  const theme = useTheme();
  const [category, setCategory] = useState('food');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = CATEGORIES.map(c => ({ c, v: expenses.filter(e => e.category === c).reduce((s, e) => s + e.amount, 0) })).filter(x => x.v > 0);

  const add = async () => {
    const value = parseAmount(amount);
    if (value == null) {
      Alert.alert('Check the amount', 'Enter a positive number, for example 450 or 1,250.50.');
      return;
    }
    const now = new Date();
    await upsertExpense({
      id: newId(),
      trip_id: tripId,
      category,
      amount: value,
      currency: 'INR',
      note: note.trim() || null,
      spent_on: now.toISOString().slice(0, 10),
      sync_status: 'pending',
      updated_at: now.toISOString(),
    });
    setAmount('');
    setNote('');
    onChanged();
  };

  const remove = (x: LocalExpense) =>
    Alert.alert('Delete expense', `${x.category} ${inr(x.amount)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(x.id);
          onChanged();
        },
      },
    ]);

  return (
    <View>
      <Card style={{ marginBottom: 12 }}>
        <Card.Content>
          <Text variant="headlineSmall">{inr(total)}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>Total on this trip</Text>
          {byCategory.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {byCategory.map(({ c, v }) => (
                <Chip key={c} compact>{c} {inr(v)}</Chip>
              ))}
            </View>
          ) : null}
        </Card.Content>
      </Card>

      {expenses.map(x => (
        <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          <View style={{ flex: 1 }}>
            <Text>{x.category}{x.note ? ` — ${x.note}` : ''}</Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{x.spent_on ?? ''}</Text>
          </View>
          <Text style={{ fontWeight: '600' }}>{inr(x.amount)}</Text>
          <IconButton icon="delete-outline" size={20} onPress={() => remove(x)} accessibilityLabel={`Delete ${x.category} expense`} />
        </View>
      ))}

      <Text variant="titleSmall" style={{ marginTop: 16 }}>Add expense</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
        {CATEGORIES.map(c => (
          <Chip key={c} selected={category === c} onPress={() => setCategory(c)} compact>{c}</Chip>
        ))}
      </View>
      <TextInput label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" mode="outlined" style={{ marginBottom: 8 }} />
      <TextInput label="Note (optional)" value={note} onChangeText={setNote} mode="outlined" style={{ marginBottom: 12 }} maxLength={LIMITS.note} />
      <Button mode="contained" onPress={add}>Add expense</Button>
    </View>
  );
}
