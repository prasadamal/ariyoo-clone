import assert from 'node:assert/strict';
import test from 'node:test';
import { isVerifiedPlace, trustedFix } from '../fixTrust';

const now = 1_800_000_000_000;

test('a fresh, accurate reading from the phone verifies the place', () => {
  assert.equal(trustedFix({ mocked: false, accuracy: 12, timestamp: now - 5_000 }, now), true);
  assert.equal(trustedFix({ accuracy: 150, timestamp: now }, now), true, 'mocked unknown (iOS) is fine');
});

test('fake-GPS apps, old readings and rough fixes do not', () => {
  assert.equal(trustedFix({ mocked: true, accuracy: 5, timestamp: now }, now), false, 'fake GPS');
  assert.equal(trustedFix({ accuracy: 900, timestamp: now }, now), false, 'too rough');
  assert.equal(trustedFix({ accuracy: null, timestamp: now }, now), false, 'no accuracy');
  assert.equal(trustedFix({ accuracy: 10, timestamp: now - 10 * 60_000 }, now), false, 'ten minutes old');
  assert.equal(trustedFix({ accuracy: 10, timestamp: now + 5 * 60_000 }, now), false, 'from the future');
});

test('a moment is verified when it kept its point', () => {
  assert.equal(isVerifiedPlace({ latitude: 9.96, longitude: 76.24 }), true);
  assert.equal(isVerifiedPlace({ latitude: null, longitude: null }), false);
  assert.equal(isVerifiedPlace({}), false);
});
