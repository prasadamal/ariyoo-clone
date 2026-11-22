import { capitalizeName } from './names';

/** Group expense splitting ("who owes whom") — pure, currency-agnostic math. */

export const ME = 'Me';

export type SplitExpense = {
  amount: number;
  /** Payer name; null/'' means "Me". */
  paidBy: string | null;
  /** Names sharing the cost. Empty = personal expense of the payer. */
  splitWith: string[];
};

export type Transfer = { from: string; to: string; amount: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseCompanions(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,;\n]+/)) {
    const name = capitalizeName(raw);
    if (!name || name.toLowerCase() === ME.toLowerCase()) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function parseSplitWith(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Net balance per person: positive = should receive, negative = owes.
 * Each expense credits the payer and debits every sharer an equal share; rounding
 * remainders go to the first sharers so totals always reconcile to zero.
 */
export function computeBalances(expenses: SplitExpense[]): Record<string, number> {
  const cents: Record<string, number> = {};
  const add = (name: string, delta: number) => {
    cents[name] = (cents[name] ?? 0) + delta;
  };
  for (const e of expenses) {
    const total = Math.round(e.amount * 100);
    if (!Number.isFinite(total) || total <= 0) continue;
    const payer = e.paidBy?.trim() || ME;
    const sharers = Array.from(new Set(e.splitWith.map(s => s.trim()).filter(Boolean)));
    if (!sharers.length) continue;
    add(payer, total);
    const base = Math.floor(total / sharers.length);
    let remainder = total - base * sharers.length;
    for (const s of sharers) {
      const share = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      add(s, -share);
    }
  }
  const out: Record<string, number> = {};
  for (const [name, c] of Object.entries(cents)) {
    if (c !== 0) out[name] = c / 100;
  }
  return out;
}

/** Greedy settle-up: largest debtor pays largest creditor. At most n-1 transfers. */
export function settleUp(balances: Record<string, number>): Transfer[] {
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0.004)
    .map(([name, v]) => ({ name, cents: Math.round(v * 100) }));
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < -0.004)
    .map(([name, v]) => ({ name, cents: Math.round(-v * 100) }));
  const transfers: Transfer[] = [];
  creditors.sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
  debtors.sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].cents, creditors[j].cents);
    if (pay > 0) transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: pay / 100 });
    debtors[i].cents -= pay;
    creditors[j].cents -= pay;
    if (debtors[i].cents === 0) i++;
    if (creditors[j].cents === 0) j++;
  }
  return transfers;
}

/** What each person actually consumed (their shares), for a "who spent what" view. */
export function sharePerPerson(expenses: SplitExpense[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    const sharers = Array.from(new Set(e.splitWith.map(s => s.trim()).filter(Boolean)));
    const people = sharers.length ? sharers : [e.paidBy?.trim() || ME];
    const share = e.amount / people.length;
    for (const p of people) out[p] = round2((out[p] ?? 0) + share);
  }
  return out;
}
