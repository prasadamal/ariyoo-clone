import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { formatMoney } from '../lib/currencyMath';

type Props = {
  /** Spent so far, in the journey's currency. */
  spent: number;
  /** The expected budget, or null/0 when none is set. */
  budget: number | null;
  currency: string;
  /** Tap target for "Add a budget" when there is none. */
  onAddBudget?: () => void;
  compact?: boolean;
};

/**
 * Spend against the expected budget, drawn on a journey cover: the bar fills as expenses are added and
 * turns red past the budget. Without a budget it shows what was spent and offers to add one.
 */
export function BudgetBar({ spent, budget, currency, onAddBudget, compact = false }: Props) {
  const hasBudget = Boolean(budget && budget > 0);
  const ratio = hasBudget ? spent / (budget as number) : 0;
  const over = ratio > 1;
  const fill = over ? '#fecaca' : '#ffffff';
  const spentText = formatMoney(spent, currency, { compact: true });
  const label = hasBudget
    ? `${spentText} spent of ${formatMoney(budget as number, currency, { compact: true })} budget${over ? ', over budget' : ''}`
    : `${spentText} spent, no budget set`;
  return (
    <View accessible accessibilityLabel={label} style={{ marginTop: compact ? 10 : 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: compact ? 14 : 16 }}>{spentText}</Text>
        <Text style={{ color: '#ffffffcc', fontSize: compact ? 12 : 13, marginLeft: 6, flex: 1 }}>
          {hasBudget ? `of ${formatMoney(budget as number, currency, { compact: true })}${over ? ' · over budget' : ''}` : 'spent'}
        </Text>
        {!hasBudget && onAddBudget ? (
          <Pressable onPress={onAddBudget} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' }}>Add a budget</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ height: compact ? 6 : 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(1, ratio) * 100}%`, height: '100%', borderRadius: 4, backgroundColor: fill }} />
      </View>
    </View>
  );
}
