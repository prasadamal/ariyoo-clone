import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidUpiId, upiKey, upiPayLink, upiRequestMessage } from '../upi';

test('UPI IDs look like name@bank', () => {
  for (const ok of ['neha.k@okaxis', 'arif_99@ybl', '9876543210@paytm', 'me-1@upi']) assert.ok(isValidUpiId(ok), ok);
  for (const bad of ['', 'neha', '@okaxis', 'neha@', 'ne ha@okaxis', 'neha@ok axis', 'neha@1bank']) assert.ok(!isValidUpiId(bad), bad);
});

test('pay link carries payee, name, amount with paise, rupees and a note', () => {
  const link = upiPayLink({ upiId: ' Neha.K@OKAXIS ', name: 'Neha', amount: 860, note: 'Goa with the gang' });
  assert.ok(link.startsWith('upi://pay?'));
  const q = new URLSearchParams(link.slice('upi://pay?'.length));
  assert.equal(q.get('pa'), 'neha.k@okaxis');
  assert.equal(q.get('pn'), 'Neha');
  assert.equal(q.get('am'), '860.00');
  assert.equal(q.get('cu'), 'INR');
  assert.equal(q.get('tn'), 'Goa with the gang');
  assert.equal(new URLSearchParams(upiPayLink({ upiId: 'a@b', name: 'A', amount: 412.345, note: 'x' }).split('?')[1]).get('am'), '412.35');
  assert.equal(new URLSearchParams(upiPayLink({ upiId: 'a@b', name: 'A', amount: 1, note: 'x'.repeat(80) }).split('?')[1]).get('tn')!.length, 50, 'note kept short');
});

test('request message names the journey and both ways to pay', () => {
  const msg = upiRequestMessage({ to: 'Arif', amount: '₹1,240', trip: 'Goa with the gang', myUpiId: 'Meera@OKICICI', link: 'upi://pay?pa=meera%40okicici' });
  assert.match(msg, /Hi Arif, your share for Goa with the gang is ₹1,240/);
  assert.match(msg, /upi:\/\/pay/);
  assert.match(msg, /\(UPI ID: meera@okicici\)/);
  assert.equal(upiKey('  Neha '), 'neha');
});
