import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '../../lib/telemetry';
import { Alert, Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import { uuid } from '../../lib/id';
import { getRates, type RatesSnapshot } from '../../lib/currency';
import { formatMoney, sumInCurrency } from '../../lib/currencyMath';
import { formatDay, timeAgoPhrase, toDayString } from '../../lib/format';
import { deleteExpense, listExpenses, updateTrip, upsertExpense, type LocalExpense, type LocalTrip } from '../../lib/localDb';
import { computeBalances, isSpending, ME, parseCompanions, parseSplitWith, SETTLEMENT, settlementFor, settleUp } from '../../lib/split';
import { useAppTheme } from '../../theme';
import { ChipSelect } from '../../ui/ChipSelect';
import { Icon } from '../../ui/Icon';
import { Notice } from '../../ui/Notice';
import { Meter } from '../../ui/Meter';
import { capitalizeName, firstName } from '../../lib/names';
import { cleanUpiId, isValidUpiId, upiKey, upiPayLink, upiRequestMessage } from '../../lib/upi';
import { getUpiIds, MY_UPI, setUpiId } from '../../lib/upiIds';
import { useToast } from '../../context/ToastContext';

/** How a person shows on a chip or row: "You" for yourself, otherwise just a first name. */
const personLabel = (name: string) => (name === ME ? 'You' : firstName(name));

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

function categoryLabel(c: string) {
  return EXPENSE_CATEGORIES.find(x => x.value === c)?.label ?? c;
}

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
  const [category, setCategory] = useState('other');
  const [noteFocused, setNoteFocused] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetText, setBudgetText] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  // UPI: IDs remembered on this phone, and the "what's their UPI ID?" box when one is missing.
  const [upiIds, setUpiIds] = useState<Record<string, string>>({});
  const [upiAsk, setUpiAsk] = useState<{ who: string; then: (id: string) => void } | null>(null);
  const [upiText, setUpiText] = useState('');
  const upiToast = useToast();
  useEffect(() => {
    getUpiIds().then(setUpiIds).catch(() => undefined);
  }, []);
  /** A UPI ID for someone (MY_UPI for yourself): remembered, or asked for once. */
  const withUpiId = (who: string, then: (id: string) => void) => {
    const known = upiIds[upiKey(who)];
    if (known) return then(known);
    setUpiText('');
    setUpiAsk({ who, then });
  };
  const payByUpi = (to: string, amount: number) =>
    withUpiId(to, async id => {
      const link = upiPayLink({ upiId: id, name: firstName(to), amount, note: trip.title });
      try {
        await Linking.openURL(link);
      } catch {
        upiToast('No UPI app found on this phone');
      }
    });
  const requestByUpi = (from: string, amount: number) =>
    withUpiId(MY_UPI, id => {
      const link = upiPayLink({ upiId: id, name: 'Wayfare', amount, note: trip.title });
      void Share.share({ message: upiRequestMessage({ to: firstName(from), amount: formatMoney(amount, 'INR'), trip: trip.title, myUpiId: id, link }) });
    });
  const [showExpenses, setShowExpenses] = useState(false);
  const [note, setNote] = useState('');
  const [paidBy, setPaidBy] = useState(ME);
  const [splitWith, setSplitWith] = useState<string[]>(people);

  const load = useCallback(async () => setExpenses(await listExpenses(trip.id)), [trip.id]);
  useEffect(() => {
    load();
    getRates().then(setRates);
  }, [load]);
  useEffect(() => setSplitWith(people), [people]);

  // "Paid back" records from Settle up move money between people; they aren't trip spending.
  const spending = useMemo(() => expenses.filter(isSpending), [expenses]);
  const total = useMemo(
    () => sumInCurrency(spending.map(e => ({ amount: e.amount, currency: e.currency })), tripCurrency, rates?.rates ?? null),
    [spending, tripCurrency, rates]
  );

  const byCategory = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of spending) {
      const v = sumInCurrency([{ amount: e.amount, currency: e.currency }], tripCurrency, rates?.rates ?? null).total;
      out[e.category] = (out[e.category] ?? 0) + v;
    }
    return Object.entries(out).sort((a, b) => b[1] - a[1]);
  }, [spending, tripCurrency, rates]);

  // Settle up separately per currency — never silently mix exchange rates into debts.
  const settlements = useMemo(() => {
    const byCur = new Map<string, LocalExpense[]>();
    for (const e of expenses) byCur.set(e.currency, [...(byCur.get(e.currency) ?? []), e]);
    return [...byCur.entries()]
      .map(([cur, list]) => ({
        currency: cur,
        transfers: settleUp(
          computeBalances(
            list.map(e => ({
              amount: e.amount,
              paidBy: e.paid_by ? capitalizeName(e.paid_by) : null,
              splitWith: parseSplitWith(e.split_with).map(capitalizeName),
            }))
          )
        ),
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
      spent_on: toDayString(new Date()), // the local day (the ISO string is UTC: wrong before 5:30 am in India)
      paid_by: paidBy === ME ? null : paidBy,
      split_with: JSON.stringify(companions.length ? splitWith : []),
      sync_status: 'pending',
      updated_at: now,
    });
    setAmount('');
    setNote('');
    setCategory('other');
    setFormOpen(false);
    void track('expense_added');
    await load();
    onChanged();
  };

  // Settle up: record that someone paid their share back (one tap, confirmed; can't be sent twice).
  const paying = useRef(false);
  const markPaid = (t: { from: string; to: string; amount: number }, cur: string) =>
    Alert.alert('Mark as paid?', `${personLabel(t.from)} paid ${personLabel(t.to)} ${formatMoney(t.amount, cur)}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark paid',
        onPress: async () => {
          if (paying.current) return;
          paying.current = true;
          try {
            const s = settlementFor(t);
            const now = new Date().toISOString();
            await upsertExpense({
              id: uuid(),
              trip_id: trip.id,
              category: SETTLEMENT,
              amount: s.amount,
              currency: cur,
              note: `${personLabel(t.from)} paid ${personLabel(t.to)} back`,
              spent_on: toDayString(new Date()), // the local day (the ISO string is UTC: wrong before 5:30 am in India)
              paid_by: s.paidBy,
              split_with: JSON.stringify(s.splitWith),
              sync_status: 'pending',
              updated_at: now,
            });
            await load();
            onChanged();
          } finally {
            paying.current = false;
          }
        },
      },
    ]);

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

  // Expenses by day, newest day first.
  const byDay = useMemo(() => {
    const map = new Map<string, LocalExpense[]>();
    for (const e of expenses) {
      const day = e.spent_on ?? toDayString(new Date(e.updated_at));
      map.set(day, [...(map.get(day) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);
  const dayHeading = (day: string) => {
    const today = toDayString(new Date());
    const yesterday = toDayString(new Date(Date.now() - 86400000));
    return day === today ? 'Today' : day === yesterday ? 'Yesterday' : formatDay(day, { weekday: true });
  };

  const saveBudget = async () => {
    const value = Number(budgetText.replace(/[^0-9.]/g, ''));
    await updateTrip(trip.id, { budget_total: value > 0 ? Math.round(value) : null });
    setBudgetOpen(false);
    onChanged();
  };
  const used = budget > 0 ? total.total / budget : 0;

  return (
    <View>
      <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
        {/* The money spent is the title; the bar below runs from 0 to the budget. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="displaySmall" style={{ fontWeight: '900', flex: 1 }} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`${formatMoney(total.total, tripCurrency)} spent`}>
            {formatMoney(total.total, tripCurrency)}
          </Text>
          {readOnly ? null : (
            <IconButton
              icon="pencil-outline"
              size={20}
              iconColor={colors.primary}
              onPress={() => {
                setBudgetText(budget > 0 ? String(budget) : '');
                setBudgetOpen(true);
              }}
              accessibilityLabel={budget > 0 ? 'Edit budget' : 'Set budget'}
              style={{ margin: 0 }}
            />
          )}
          {byCategory.length ? (
            // Spending by category stays folded until you open it with the arrow.
            <IconButton
              icon={showCategories ? 'chevron-up' : 'chevron-down'}
              size={22}
              onPress={() => setShowCategories(v => !v)}
              accessibilityLabel={showCategories ? 'Hide spending by category' : 'Show spending by category'}
              style={{ margin: 0 }}
            />
          ) : null}
        </View>
        {budget > 0 ? (
          <View
            accessible
            accessibilityLabel={used > 1 ? `${formatMoney(total.total - budget, tripCurrency)} over the ${formatMoney(budget, tripCurrency)} budget` : `${formatMoney(budget - total.total, tripCurrency)} left of the ${formatMoney(budget, tripCurrency)} budget`}
          >
            <Meter progress={Math.min(1, used)} color={used > 1 ? colors.danger : used > 0.85 ? colors.warning : colors.primary} height={8} style={{ marginTop: 10 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>{formatMoney(0, tripCurrency)}</Text>
              <Text style={{ color: used > 1 ? colors.danger : colors.muted, fontSize: 13, fontWeight: '600' }}>{formatMoney(budget, tripCurrency)}</Text>
            </View>
          </View>
        ) : null}
        {budget <= 0 ? (
          <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13 }}>{readOnly ? 'No budget set for this journey.' : 'No budget yet. Tap the pencil to set one.'}</Text>
        ) : null}
        {total.unconverted.length ? (
          <Notice tone="warning" text={`${total.unconverted.join(', ')} not included — connect once to download exchange rates.`} />
        ) : rates && expenses.some(e => e.currency !== tripCurrency) ? (
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
            Converted with {rates.source} rates from {timeAgoPhrase(rates.fetchedAt)}.
          </Text>
        ) : null}
        {byCategory.length && showCategories ? (
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
        <Button mode="contained" icon="plus" onPress={() => setFormOpen(true)} style={{ marginTop: 14 }} contentStyle={{ height: 48 }}>
          Add expense
        </Button>
      )}

      {settlements.length ? (
        <View style={{ backgroundColor: colors.surfaceVariant, borderRadius: 18, padding: 16, marginTop: 16 }}>
          <Pressable onPress={() => setShowSettle(v => !v)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 16 }}>Settle up</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {settlements.reduce((n, s) => n + s.transfers.length, 0)} payment{settlements.reduce((n, s) => n + s.transfers.length, 0) === 1 ? '' : 's'} square everyone up
              </Text>
            </View>
            <Icon name={showSettle ? 'chevron-up' : 'chevron-down'} size={22} color={colors.muted} />
          </Pressable>
          {showSettle && settlements.map(s =>
            s.transfers.map((t, i, arr) => (
              <View
                key={`${s.currency}-${t.from}-${t.to}`}
                style={{ paddingVertical: 8, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: colors.border, gap: 6 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontWeight: '700' }} numberOfLines={1}>{personLabel(t.from)}</Text>
                  <Icon name="arrow-right" size={16} color={colors.muted} />
                  <Text style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>{personLabel(t.to)}</Text>
                  <Text style={{ fontWeight: '800', color: colors.secondary }}>{formatMoney(t.amount, s.currency)}</Text>
                  {/* Between two other people (or not in rupees): just "Paid", on the same line. */}
                  {readOnly || (s.currency === 'INR' && (t.from === ME || t.to === ME)) ? null : (
                    <Button compact mode="outlined" onPress={() => markPaid(t, s.currency)} accessibilityLabel={`Mark ${personLabel(t.from)} paid ${personLabel(t.to)}`}>
                      Paid
                    </Button>
                  )}
                </View>
                {readOnly || !(s.currency === 'INR' && (t.from === ME || t.to === ME)) ? null : (
                  // UPI for rupees: "Pay" when you owe, "Request" when you're owed. "Paid" records it.
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                    {s.currency === 'INR' && t.from === ME ? (
                      <Button compact mode="contained" icon="cellphone-arrow-down" onPress={() => payByUpi(t.to, t.amount)} accessibilityLabel={`Pay ${personLabel(t.to)} with UPI`}>
                        Pay with UPI
                      </Button>
                    ) : null}
                    {s.currency === 'INR' && t.to === ME ? (
                      <Button compact mode="contained-tonal" icon="send-outline" onPress={() => requestByUpi(t.from, t.amount)} accessibilityLabel={`Ask ${personLabel(t.from)} to pay with UPI`}>
                        Request
                      </Button>
                    ) : null}
                    <Button compact mode="outlined" onPress={() => markPaid(t, s.currency)} accessibilityLabel={`Mark ${personLabel(t.from)} paid ${personLabel(t.to)}`}>
                      Paid
                    </Button>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      ) : null}

      {expenses.length ? (
        <View style={{ backgroundColor: colors.surfaceVariant, borderRadius: 18, padding: 16, marginTop: 16 }}>
          <Pressable onPress={() => setShowExpenses(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: showExpenses }} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 16 }}>Expenses</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}{readOnly ? '' : ' · long-press one to delete'}
              </Text>
            </View>
            <Icon name={showExpenses ? 'chevron-up' : 'chevron-down'} size={22} color={colors.muted} />
          </Pressable>
          {showExpenses ? (
            <View style={{ marginTop: 6 }}>
            {/* Grouped by day, newest first, so the list reads like a statement. */}
            {byDay.map(([day, list]) => (
              <View key={day} style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 2 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>{dayHeading(day).toUpperCase()}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
                    {formatMoney(sumInCurrency(list.filter(isSpending).map(e => ({ amount: e.amount, currency: e.currency })), tripCurrency, rates?.rates ?? null).total, tripCurrency)}
                  </Text>
                </View>
                {list.map(e => {
                  const split = parseSplitWith(e.split_with);
                  return (
                    <Pressable key={e.id} disabled={readOnly} onLongPress={() => remove(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={e.category === SETTLEMENT ? 'handshake-outline' : categoryIcon(e.category)} size={18} color={colors.onPrimaryContainer} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', textTransform: 'capitalize' }} numberOfLines={1}>{e.note || e.category}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {e.paid_by || companions.length || !e.note ? '' : categoryLabel(e.category)}
                          {e.paid_by ? `Paid by ${firstName(capitalizeName(e.paid_by))}` : companions.length ? 'Paid by you' : ''}
                          {split.length > 1 ? ` · split ${split.length} ways` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontWeight: '800' }}>{formatMoney(e.amount, e.currency)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <Portal>
        <Dialog visible={!!upiAsk} onDismiss={() => setUpiAsk(null)}>
          <Dialog.Title>{upiAsk?.who === MY_UPI ? 'Your UPI ID' : `${upiAsk ? firstName(upiAsk.who) : ''}\u2019s UPI ID`}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="UPI ID"
              placeholder="name@okaxis"
              value={upiText}
              onChangeText={setUpiText}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              error={!!upiText.trim() && !isValidUpiId(upiText)}
            />
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
              {upiAsk?.who === MY_UPI ? 'Friends pay this ID from the link you send.' : 'Saved on this phone for next time.'} It\u2019s shown in GPay, PhonePe or Paytm under your profile.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUpiAsk(null)}>Cancel</Button>
            <Button
              mode="contained"
              disabled={!isValidUpiId(upiText)}
              onPress={async () => {
                const ask = upiAsk;
                if (!ask) return;
                const id = cleanUpiId(upiText);
                setUpiIds(await setUpiId(ask.who, id));
                setUpiAsk(null);
                ask.then(id);
              }}
            >
              Continue
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog visible={formOpen} onDismiss={() => setFormOpen(false)} style={{ maxHeight: '88%' }}>
          <Dialog.Title>Add expense</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 20 }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 8 }}>

              <View style={{ gap: 10 }}>
                <TextInput
                  mode="outlined"
                  label={`Amount (${tripCurrency})`}
                  value={amount}
                  onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  style={{ flex: 1 }}
                />
                <TextInput
                  mode="outlined"
                  label="Note"
                  value={note}
                  onChangeText={setNote}
                  onFocus={() => setNoteFocused(true)}
                  onBlur={() => setTimeout(() => setNoteFocused(false), 200)}
                  style={{ flex: 1.4 }}
                />
              </View>
              <View style={{ marginTop: 10, gap: 10 }}>
                {/* Ideas for the note (and the expense's category) appear only while you're writing it. */}
                {noteFocused ? (
                  <ChipSelect
                    scroll
                    options={EXPENSE_CATEGORIES}
                    value={category}
                    onChange={c => {
                      setCategory(c);
                      const label = EXPENSE_CATEGORIES.find(x => x.value === c)?.label ?? '';
                      if (!note.trim()) setNote(label);
                    }}
                  />
                ) : null}
                {companions.length ? (
                  <>
                    <Text style={{ fontWeight: '600' }}>Paid by</Text>
                    <ChipSelect scroll options={people.map(p => ({ value: p, label: personLabel(p) }))} value={paidBy} onChange={setPaidBy} />
                    <Text style={{ fontWeight: '600' }}>Split between</Text>
                    <ChipSelect multi options={people.map(p => ({ value: p, label: personLabel(p) }))} value={splitWith} onChange={setSplitWith} />
                  </>
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Add companions to this journey (Edit) to split costs.</Text>
                )}
                <Button mode="contained" icon="check" onPress={add} disabled={!(Number(amount) > 0) || (companions.length > 0 && !splitWith.length)}>
                  Add {amount ? formatMoney(Number(amount) || 0, currency) : 'expense'}
                </Button>
              </View>
        
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog visible={budgetOpen} onDismiss={() => setBudgetOpen(false)}>
          <Dialog.Title>Expected budget</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label={`Budget (${tripCurrency})`}
              value={budgetText}
              onChangeText={t => setBudgetText(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>Leave empty to remove the budget.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBudgetOpen(false)}>Cancel</Button>
            <Button mode="contained" onPress={saveBudget}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
