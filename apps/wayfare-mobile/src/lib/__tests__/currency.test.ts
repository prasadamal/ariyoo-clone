import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convert, currencySymbol, formatMoney, formatPendingMoney, splitSpend, sumInCurrency } from '../currencyMath';

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

test('partial spend keeps unconverted amounts visible', () => {
  const noRates = splitSpend({ INR: 1000, USD: 50 }, 'INR', null);
  assert.equal(noRates.total, 1000);
  assert.deepEqual(noRates.pending, [{ currency: 'USD', amount: 50 }]);
  assert.equal(formatPendingMoney(noRates.pending), '$50');
  const withRates = splitSpend({ INR: 1000, USD: 50 }, 'INR', rates);
  assert.equal(Math.round(withRates.total), 1000 + 50 * 83);
  assert.deepEqual(withRates.pending, []);
  assert.deepEqual(splitSpend({}, 'INR', null), { total: 0, pending: [] });
});

test('compact amounts read naturally in every currency', () => {
  assert.equal(formatMoney(4515000, 'IDR', { compact: true }), 'Rp4.5M');
  assert.equal(formatMoney(250000, 'INR', { compact: true }), '₹2.5L');
  assert.equal(formatMoney(25000000, 'INR', { compact: true }), '₹2.5Cr');
  assert.equal(formatMoney(120000, 'LKR', { compact: true }), 'Rs120k');
  assert.equal(formatMoney(12000000, 'VND', { compact: true }), '₫12M');
});
