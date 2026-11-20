/** Money spent at a journal moment: totals per moment, and the sum shown on a trip's cover. */
export type MomentExpense = { entry_id?: string | null; amount: number };

/** entry id -> total spent at that moment. Expenses with no moment are not included. */
export function totalsByMoment(expenses: MomentExpense[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of expenses) {
    if (!e.entry_id) continue;
    out.set(e.entry_id, Math.round(((out.get(e.entry_id) ?? 0) + e.amount) * 100) / 100);
  }
  return out;
}

/** Everything spent on the trip: moment money and plain expenses together, as on the cover. */
export function totalSpent(expenses: { amount: number }[]): number {
  return Math.round(expenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
}

/** "₹1,250" or "₹1,250.50"; whole amounts stay clean. */
export function formatMoney(amount: number, symbol = '₹'): string {
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Reads what someone typed into an amount box: digits with an optional decimal point, above zero. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 && n <= 99_999_999 ? n : null;
}
