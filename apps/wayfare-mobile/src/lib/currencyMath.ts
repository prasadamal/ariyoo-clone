/** Pure currency helpers. Rates are "units per 1 USD" (open.er-api.com convention). */

export type Rates = Record<string, number>;

export const POPULAR_CURRENCIES = [
  'INR', 'USD', 'EUR', 'GBP', 'NPR', 'THB', 'IDR', 'LKR', 'VND', 'AED', 'SGD', 'MYR', 'JPY', 'AUD', 'BTN', 'CAD', 'CHF',
] as const;

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', THB: '฿', VND: '₫', NPR: 'रू', LKR: 'Rs', IDR: 'Rp',
  AED: 'AED ', SGD: 'S$', MYR: 'RM', AUD: 'A$', CAD: 'C$', CHF: 'CHF ', BTN: 'Nu.',
};

export function currencySymbol(code: string) {
  return SYMBOLS[code.toUpperCase()] ?? `${code.toUpperCase()} `;
}

/** Converts using USD-based rates; returns null when either currency is unknown. */
export function convert(amount: number, from: string, to: string, rates: Rates): number | null {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;
  const rf = f === 'USD' ? 1 : rates[f];
  const rt = t === 'USD' ? 1 : rates[t];
  if (!rf || !rt) return null;
  return (amount / rf) * rt;
}

const ZERO_DECIMAL = new Set(['JPY', 'VND', 'IDR', 'KRW']);

export function formatMoney(amount: number, currency: string, opts: { compact?: boolean } = {}) {
  const code = currency.toUpperCase();
  const sym = currencySymbol(code);
  const abs = Math.abs(amount);
  let body: string;
  if (opts.compact && abs >= 100000) {
    body = code === 'INR' && abs < 10000000 ? `${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L` : `${(abs / 1000).toFixed(0)}k`;
  } else {
    const decimals = ZERO_DECIMAL.has(code) || abs >= 1000 || Number.isInteger(abs) ? 0 : 2;
    body = abs.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return `${amount < 0 ? '-' : ''}${sym}${body}`;
}

/** Sums mixed-currency amounts into one target currency; unknown currencies are reported. */
export function sumInCurrency(items: { amount: number; currency: string }[], target: string, rates: Rates | null) {
  let total = 0;
  const unconverted = new Set<string>();
  for (const it of items) {
    if (it.currency.toUpperCase() === target.toUpperCase()) {
      total += it.amount;
      continue;
    }
    const v = rates ? convert(it.amount, it.currency, target, rates) : null;
    if (v == null) unconverted.add(it.currency.toUpperCase());
    else total += v;
  }
  return { total, unconverted: Array.from(unconverted) };
}

export type MoneyAmount = { amount: number; currency: string };

/**
 * Splits a per-currency spend map into one converted total plus the amounts that could not be
 * converted (no exchange rate yet), so screens can say "₹1,000 + $50" instead of a short total.
 */
export function splitSpend(byCurrency: Record<string, number>, target: string, rates: Rates | null) {
  const items = Object.entries(byCurrency).map(([currency, amount]) => ({ currency, amount }));
  const { total, unconverted } = sumInCurrency(items, target, rates);
  const pending: MoneyAmount[] = unconverted
    .map(code => ({
      currency: code,
      amount: items.filter(i => i.currency.toUpperCase() === code).reduce((sum, i) => sum + i.amount, 0),
    }))
    .filter(p => p.amount !== 0);
  return { total, pending };
}

/** "$50 + €20" for amounts still waiting on an exchange rate. */
export function formatPendingMoney(pending: MoneyAmount[], opts: { compact?: boolean } = {}) {
  return pending.map(p => formatMoney(p.amount, p.currency, opts)).join(' + ');
}
