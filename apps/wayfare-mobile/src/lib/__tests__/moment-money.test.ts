import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMoney, parseAmount, totalSpent, totalsByMoment } from '../momentMoney';

test('money per moment adds up, and plain expenses are not attached to any moment', () => {
  const totals = totalsByMoment([
    { entry_id: 'm1', amount: 250.1 },
    { entry_id: 'm1', amount: 120.2 },
    { entry_id: 'm2', amount: 80 },
    { entry_id: null, amount: 999 },
    { amount: 5 },
  ]);
  assert.deepEqual([...totals.entries()], [['m1', 370.3], ['m2', 80]]);
});

test('the cover total counts moment money and plain expenses together', () => {
  assert.equal(totalSpent([{ amount: 250.1 }, { amount: 120.2 }, { amount: 999 }]), 1369.3);
  assert.equal(totalSpent([]), 0);
});

test('amounts show cleanly in rupees', () => {
  assert.equal(formatMoney(1250), '₹1,250');
  assert.equal(formatMoney(1250.5), '₹1,250.50');
  assert.equal(formatMoney(125000), '₹1,25,000');
});

test('what people type into an amount box is checked', () => {
  assert.equal(parseAmount('250'), 250);
  assert.equal(parseAmount(' ₹1,250.50 '), 1250.5);
  for (const bad of ['', '0', '-5', 'abc', '12.345', '1e5', '100000000']) assert.equal(parseAmount(bad), null, bad);
});
