import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { uuid } from '../../lib/id';
import { getRates, type RatesSnapshot } from '../../lib/currency';
import { formatMoney, sumInCurrency } from '../../lib/currencyMath';
import { timeAgo } from '../../lib/format';
import { deleteExpense, listExpenses, upsertExpense, type LocalExpense, type LocalTrip } from '../../lib/localDb';
import { computeBalances, ME, parseCompanions, parseSplitWith, settleUp } from '../../lib/split';
import { useAppTheme } from '../../theme';
import { ChipSelect } from '../../ui/ChipSelect';
import { Icon } from '../../ui/Icon';
import { Notice } from '../../ui/Notice';
import { SectionHeader } from '../../ui/SectionHeader';
import { Meter } from '../../ui/Meter';

/** readOnly: a crew member (not an admin) sees the spending but can't change it. */
type Props = { trip: LocalTrip; onChanged: () => void; readOnly?: boolean };

export const EXPENSE_CATEGORIES = [
  { value: 'food', label: 'Food', icon: 'silverware-fork-knife' },
  { value: 'stay', label: 'Stay', icon: 'bed-outline' },
  { value: 'transport', label: 'Transport', icon: 'bus' },
  { value: 'gear', label: 'Gear', icon: 'bag-personal-outline' },
  { value: 'permit', label: 'Permits', icon: 'card-account-details-outline' },
  { value: 'activity', label: 'Activities', icon: 'ticket-outline' },
  { value: 'other', label: 'Other', icon: 'dots-horizontal' },
];

function categoryIcon(c: string) {
  return EXPENSE_CATEGORIES.find(x => x.value === c)?.icon ?? 'cash';
}

export function BudgetTab({ trip, onChanged, readOnly = false }: Props) {
  const { colors } = useAppTheme();
  const tripCurrency = trip.currency || 'INR';
  const companions = useMemo(() => parseCompanions(trip.companions), [trip.companions]);
  const people = useMemo(() => [ME, ...companions], [companions]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [rates, setRates] = useState<RatesSnapshot | null>(null);
  const [amount, setAmount] = useState('');
  // Expenses use the journey's currency, chosen once when the journey is created.
  const currency = tripCurrency;
  const [category, setCategory] = useState('food');
  const [note, setNote] = useState('');
  const [paidBy, setPaidBy] = useState(ME);
  const [splitWith, setSplitWith] = useState<string[]>(people);

  const load = useCallback(async () => setExpenses(await listExpenses(trip.id)), [trip.id]);
  useEffect(() => {
    load();
    getRates().then(setRates);
  }, [load]);
  useEffect(() => setSplitWith(people), [people]);

  const total = useMemo(
    () => sumInCurrency(expenses.map(e => ({ amount: e.amount, currency: e.currency })), tripCurrency, rates?.rates ?? null),
    [expenses, tripCurrency, rates]
  );

  const byCategory = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of expenses) {
      const v = sumInCurrency([{ amount: e.amount, currency: e.currency }], tripCurrency, rates?.rates ?? null).total;
      out[e.category] = (out[e.category] ?? 0) + v;
    }
    return Object.entries(out).sort((a, b) => b[1] - a[1]);
  }, [expenses, tripCurrency, rates]);

  // Settle up separately per currency — never silently mix exchange rates into debts.
  const settlements = useMemo(() => {
    const byCur = new Map<string, LocalExpense[]>();
    for (const e of expenses) byCur.set(e.currency, [...(byCur.get(e.currency) ?? []), e]);
    return [...byCur.entries()]
      .map(([cur, list]) => ({
        currency: cur,
        transfers: settleUp(computeBalances(list.map(e => ({ amount: e.amount, paidBy: e.paid_by, splitWith: parseSplitWith(e.split_with) })))),
      }))
      .filter(s => s.transfers.length);
  }, [expenses]);

  const add = async () => {
    const value = Number(amount);
    if (!(value > 0)) return;
    const now = new Date().toISOString();
    await upsertExpense({
      id: uuid(),
      trip_id: trip.id,
      category,
      amount: Math.round(value * 100) / 100,
      currency,
      note: note.trim() || null,
      spent_on: now.slice(0, 10),
      paid_by: paidBy === ME ? null : paidBy,
      split_with: JSON.stringify(companions.length ? splitWith : []),
      sync_status: 'pending',
      updated_at: now,
    });
    setAmount('');
    setNote('');
    await load();
    onChanged();
  };

  const remove = (e: LocalExpense) =>
    Alert.alert('Delete expense?', `${e.category} · ${formatMoney(e.amount, e.currency)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(e.id);
          await load();
          onChanged();
        },
      },
    ]);

  const budget = trip.budget_total ?? 0;
  const used = budget > 0 ? total.total / budget : 0;

  return (
    <View>
      <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>SPENT SO FAR</Text>
        <Text variant="displaySmall" style={{ fontWeight: '900' }}>
          {formatMoney(total.total, tripCurrency)}
        </Text>
        {budget > 0 ? (
          <>
            <Meter progress={Math.min(1, used)} color={used > 1 ? colors.danger : used > 0.85 ? colors.warning : colors.secondary} height={8} style={{ marginTop: 10 }} />
            <Text style={{ color: used > 1 ? colors.danger : colors.muted, marginTop: 6, fontSize: 13 }}>
              {used > 1
                ? `${formatMoney(total.total - budget, tripCurrency)} over your ${formatMoney(budget, tripCurrency)} expected budget`
                : `${formatMoney(budget - total.total, tripCurrency)} left of your ${formatMoney(budget, tripCurrency)} expected budget`}
            </Text>
          </>
        ) : null}
        {budget <= 0 ? (
          <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13 }}>No expected budget set. Add one under Edit to track what is left.</Text>
        ) : null}
        {total.unconverted.length ? (
          <Notice tone="warning" text={`${total.unconverted.join(', ')} not included — connect once to download exchange rates.`} />
        ) : rates && expenses.some(e => e.currency !== tripCurrency) ? (
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
            Converted with {rates.source} rates from {timeAgo(rates.fetchedAt)} ago.
          </Text>
        ) : null}
        {byCategory.length ? (
          <View style={{ marginTop: 12, gap: 6 }}>
            {byCategory.map(([cat, v]) => (
              <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name={categoryIcon(cat)} size={16} color={colors.onSurfaceVariant} />
                <Text style={{ width: 82, textTransform: 'capitalize' }}>{cat}</Text>
                <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceVariant, overflow: 'hidden' }}>
                  <View style={{ width: `${total.total ? Math.max(4, (v / total.total) * 100) : 0}%`, height: 8, backgroundColor: colors.primary }} />
                </View>
                <Text style={{ width: 84, textAlign: 'right', fontSize: 12 }}>{formatMoney(v, tripCurrency, { compact: true })}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {readOnly ? null : (
      <>
      <SectionHeader title="Add expense" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          mode="outlined"
          label={`Amount (${tripCurrency})`}
          value={amount}
          onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          style={{ flex: 1 }}
        />
        <TextInput mode="outlined" label="Note" value={note} onChangeText={setNote} style={{ flex: 1.4 }} />
      </View>
      <View style={{ marginTop: 10, gap: 10 }}>
        <ChipSelect scroll options={EXPENSE_CATEGORIES} value={category} onChange={setCategory} />
        {companions.length ? (
          <>
            <Text style={{ fontWeight: '600' }}>Paid by</Text>
            <ChipSelect scroll options={people.map(p => ({ value: p, label: p }))} value={paidBy} onChange={setPaidBy} />
            <Text style={{ fontWeight: '600' }}>Split between</Text>
            <ChipSelect multi options={people.map(p => ({ value: p, label: p }))} value={splitWith} onChange={setSplitWith} />
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12 }}>Add companions to this journey (Edit) to split costs.</Text>
        )}
        <Button mode="contained" icon="plus" onPress={add} disabled={!(Number(amount) > 0) || (companions.length > 0 && !splitWith.length)}>
          Add {amount ? formatMoney(Number(amount) || 0, currency) : 'expense'}
        </Button>
      </View>
      </>
      )}

      {settlements.length ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 20 }}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>Settle up</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>Fewest payments to square everyone up</Text>
          {settlements.map(s =>
            s.transfers.map((t, i, arr) => (
              <View
                key={`${s.currency}-${t.from}-${t.to}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: colors.border }}
              >
                <Text style={{ fontWeight: '700' }}>{t.from}</Text>
                <Icon name="arrow-right" size={16} color={colors.muted} />
                <Text style={{ fontWeight: '700', flex: 1 }}>{t.to}</Text>
                <Text style={{ fontWeight: '800', color: colors.secondary }}>{formatMoney(t.amount, s.currency)}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {expenses.length ? <SectionHeader title="Expenses" subtitle={readOnly ? undefined : 'Long-press to delete'} /> : null}
      {expenses.map(e => {
        const split = parseSplitWith(e.split_with);
        return (
          <Pressable key={e.id} disabled={readOnly} onLongPress={() => remove(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={categoryIcon(e.category)} size={18} color={colors.onPrimaryContainer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', textTransform: 'capitalize' }}>{e.note || e.category}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {e.spent_on ?? ''}
                {e.paid_by ? ` · paid by ${e.paid_by}` : companions.length ? ' · paid by you' : ''}
                {split.length > 1 ? ` · split ${split.length} ways` : ''}
              </Text>
            </View>
            <Text style={{ fontWeight: '800' }}>{formatMoney(e.amount, e.currency)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
