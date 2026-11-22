import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { IconButton, Text, TextInput } from 'react-native-paper';
import { getRates, type RatesSnapshot } from '../../src/lib/currency';
import { POPULAR_CURRENCIES, convert, formatMoney } from '../../src/lib/currencyMath';
import { timeAgo } from '../../src/lib/format';
import { useAppTheme } from '../../src/theme';
import { ChipSelect } from '../../src/ui/ChipSelect';
import { Notice } from '../../src/ui/Notice';
import { Screen } from '../../src/ui/Screen';
import { SectionHeader } from '../../src/ui/SectionHeader';

const QUICK = [100, 500, 1000, 5000];

export default function CurrencyScreen() {
  const { colors } = useAppTheme();
  const [rates, setRates] = useState<RatesSnapshot | null | undefined>(undefined);
  const [amount, setAmount] = useState('1000');
  const [from, setFrom] = useState('INR');
  const [to, setTo] = useState('NPR');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    setRefreshing(true);
    setRates(await getRates(force));
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  const value = Number(amount) || 0;
  const result = rates ? convert(value, from, to, rates.rates) : null;
  const unit = rates ? convert(1, from, to, rates.rates) : null;
  const table = useMemo(
    () => (rates ? QUICK.map(q => ({ q, v: convert(q, from, to, rates.rates) })) : []),
    [rates, from, to]
  );

  return (
    <Screen onRefresh={() => load(true)} refreshing={refreshing}>
      {rates === null ? <Notice tone="warning" text="No exchange rates yet — connect to the internet once and they will be saved for offline use." /> : null}
      <TextInput
        mode="outlined"
        label={`Amount in ${from}`}
        value={amount}
        onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        style={{ fontSize: 22 }}
      />
      <Text style={{ fontWeight: '700', marginTop: 12, marginBottom: 4 }}>From</Text>
      <ChipSelect scroll options={POPULAR_CURRENCIES.map(c => ({ value: c, label: c }))} value={from} onChange={setFrom} />
      <View style={{ alignItems: 'center' }}>
        <IconButton icon="swap-vertical" mode="contained-tonal" onPress={() => { setFrom(to); setTo(from); }} accessibilityLabel="Swap currencies" />
      </View>
      <Text style={{ fontWeight: '700', marginBottom: 4 }}>To</Text>
      <ChipSelect scroll options={POPULAR_CURRENCIES.map(c => ({ value: c, label: c }))} value={to} onChange={setTo} />

      <View style={{ marginTop: 18, padding: 18, borderRadius: 20, backgroundColor: colors.secondaryContainer }}>
        <Text style={{ color: colors.onSecondaryContainer }}>{formatMoney(value, from)} is about</Text>
        <Text style={{ color: colors.onSecondaryContainer, fontSize: 34, fontWeight: '900' }} adjustsFontSizeToFit numberOfLines={1}>
          {result == null ? '—' : formatMoney(result, to)}
        </Text>
        {result == null ? (
          <Text style={{ color: colors.onSecondaryContainer, fontSize: 12 }}>Go online once to download exchange rates; they're then saved for offline use.</Text>
        ) : null}
        {unit != null ? (
          <Text style={{ color: colors.onSecondaryContainer, fontSize: 12 }}>
            1 {from} = {unit < 0.01 ? unit.toPrecision(3) : unit.toFixed(unit < 1 ? 4 : 2)} {to}
          </Text>
        ) : null}
      </View>

      {table.length ? (
        <>
          <SectionHeader title="Quick reference" />
          {table.map(({ q, v }) => (
            <View key={q} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text>{formatMoney(q, from)}</Text>
              <Text style={{ fontWeight: '700' }}>{v == null ? '—' : formatMoney(v, to)}</Text>
            </View>
          ))}
        </>
      ) : null}
      {rates ? (
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12 }}>
          Mid-market rates from {rates.source}, updated {timeAgo(rates.fetchedAt)} ago. Card and exchange-counter rates will differ. Pull to refresh.
        </Text>
      ) : null}
    </Screen>
  );
}
