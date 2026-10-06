import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convert, currencySymbol, formatMoney, sumInCurrency } from '../currencyMath';

const rates = { USD: 1, INR: 83, NPR: 132.8, EUR: 0.92 };

test('convert via USD base', () => {
  assert.equal(convert(83, 'INR', 'USD', rates), 1);
  assert.ok(Math.abs((convert(100, 'INR', 'NPR', rates) ?? 0) - 160) < 0.01);
  assert.equal(convert(5, 'EUR', 'EUR', {}), 5);
  assert.equal(convert(1, 'XYZ', 'INR', rates), null);
});

test('symbols and money formatting', () => {
  assert.equal(currencySymbol('inr'), '₹');
  assert.equal(currencySymbol('ABC'), 'ABC ');
  assert.equal(formatMoney(1234.5, 'INR'), '₹1,235');
  assert.equal(formatMoney(12.5, 'USD'), '$12.50');
  assert.equal(formatMoney(-40, 'EUR'), '-€40');
  assert.equal(formatMoney(250000, 'INR', { compact: true }), '₹2.5L');
});

test('sumInCurrency reports what it could not convert', () => {
  const r = sumInCurrency(
    [
      { amount: 830, currency: 'INR' },
      { amount: 10, currency: 'USD' },
      { amount: 3, currency: 'XYZ' },
    ],
    'INR',
    rates
  );
  assert.equal(Math.round(r.total), 1660);
  assert.deepEqual(r.unconverted, ['XYZ']);
  assert.deepEqual(sumInCurrency([{ amount: 5, currency: 'USD' }], 'INR', null).unconverted, ['USD']);
});
