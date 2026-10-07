import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeBalances, ME, parseCompanions, parseSplitWith, settleUp, sharePerPerson } from '../split';

test('parseCompanions trims, dedupes and drops "Me"', () => {
  assert.deepEqual(parseCompanions(' Asha, Ravi;asha\nMe ,  Kabir  Singh '), ['Asha', 'Ravi', 'Kabir Singh']);
  assert.deepEqual(parseCompanions(null), []);
});

test('parseSplitWith tolerates junk', () => {
  assert.deepEqual(parseSplitWith('["Me","Asha"]'), ['Me', 'Asha']);
  assert.deepEqual(parseSplitWith('not json'), []);
  assert.deepEqual(parseSplitWith('{"a":1}'), []);
});

test('balances net to zero and remainders are assigned deterministically', () => {
  const b = computeBalances([
    { amount: 100, paidBy: null, splitWith: [ME, 'Asha', 'Ravi'] },
    { amount: 60, paidBy: 'Asha', splitWith: [ME, 'Asha'] },
  ]);
  const total = Object.values(b).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total) < 1e-9, `balances sum to ${total}`);
  // Me paid 100, owes 33.34 + 30 → +36.66; Asha paid 60, owes 33.33 + 30 → -3.33; Ravi owes 33.33.
  assert.equal(b[ME], 36.66);
  assert.equal(b.Asha, -3.33);
  assert.equal(b.Ravi, -33.33);
});

test('personal expenses (no sharers) do not create debts', () => {
  assert.deepEqual(computeBalances([{ amount: 500, paidBy: null, splitWith: [] }]), {});
});

test('settleUp produces minimal transfers that clear every balance', () => {
  const balances = computeBalances([
    { amount: 300, paidBy: 'A', splitWith: ['A', 'B', 'C'] },
    { amount: 90, paidBy: 'B', splitWith: ['A', 'B', 'C'] },
  ]);
  const transfers = settleUp(balances);
  assert.ok(transfers.length <= 2);
  const net: Record<string, number> = { ...balances };
  for (const t of transfers) {
    net[t.from] += t.amount;
    net[t.to] -= t.amount;
  }
  for (const v of Object.values(net)) assert.ok(Math.abs(v) < 0.01);
  assert.deepEqual(transfers[0], { from: 'C', to: 'A', amount: 130 });
});

test('sharePerPerson splits shared costs and keeps personal costs with the payer', () => {
  assert.deepEqual(
    sharePerPerson([
      { amount: 90, paidBy: 'A', splitWith: ['A', 'B', 'C'] },
      { amount: 40, paidBy: null, splitWith: [] },
    ]),
    { A: 30, B: 30, C: 30, Me: 40 }
  );
});
