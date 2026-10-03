import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAuthUrl } from '../src/lib/authLink';
import { haversineM, pathLengthM } from '../src/lib/geo';
import { buildStoragePath, extForMime, kindForMime, normalizeMime } from '../src/lib/mediaTypes';
import { summarize } from '../src/lib/tripStats';
import { isValidIsoDate, isValidShareId, parseAmount, validateEmail, validatePassword, validateTripForm } from '../src/lib/validation';

describe('validation', () => {
  it('validates ISO dates strictly', () => {
    assert.equal(isValidIsoDate('2026-12-31'), true);
    assert.equal(isValidIsoDate('2026-02-30'), false);
    assert.equal(isValidIsoDate('31-12-2026'), false);
    assert.equal(isValidIsoDate('2026-1-1'), false);
  });

  it('validates the trip form', () => {
    const base = { title: 'Kedarkantha', destination: '', startsOn: '', endsOn: '', companions: '', notes: '' };
    assert.equal(validateTripForm(base), null);
    assert.match(validateTripForm({ ...base, title: '  ' })!, /title/i);
    assert.match(validateTripForm({ ...base, startsOn: '2026-12-10', endsOn: '2026-12-01' })!, /on or after/);
    assert.match(validateTripForm({ ...base, startsOn: 'tomorrow' })!, /Start date/);
    assert.match(validateTripForm({ ...base, title: 'x'.repeat(121) })!, /120/);
  });

  it('parses amounts', () => {
    assert.equal(parseAmount('450'), 450);
    assert.equal(parseAmount('₹1,250.50'), 1250.5);
    assert.equal(parseAmount('0'), null);
    assert.equal(parseAmount('-5'), null);
    assert.equal(parseAmount('12.345'), null);
    assert.equal(parseAmount('abc'), null);
    assert.equal(parseAmount('1000000000'), null);
  });

  it('validates credentials and share ids', () => {
    assert.equal(validateEmail('a@b.co'), true);
    assert.equal(validateEmail('a@b'), false);
    assert.notEqual(validatePassword('short1'), null);
    assert.notEqual(validatePassword('allletters'), null);
    assert.equal(validatePassword('trek2026ok'), null);
    assert.equal(isValidShareId('a'.repeat(32)), true);
    assert.equal(isValidShareId('short'), false);
    assert.equal(isValidShareId('x'.repeat(20) + '<script>'), false);
  });
});

describe('auth links', () => {
  it('parses recovery fragments', () => {
    const l = parseAuthUrl('wayfare://auth/callback#access_token=AAA&refresh_token=BBB&type=recovery&expires_in=3600');
    assert.deepEqual([l?.type, l?.accessToken, l?.refreshToken], ['recovery', 'AAA', 'BBB']);
  });
  it('parses PKCE codes and errors', () => {
    assert.equal(parseAuthUrl('wayfare://auth/callback?code=abc123')?.code, 'abc123');
    assert.match(parseAuthUrl('wayfare://auth/callback#error=access_denied&error_description=Link+expired')?.error ?? '', /Link expired/);
  });
  it('returns null when there is nothing to parse', () => {
    assert.equal(parseAuthUrl('wayfare://auth/callback'), null);
    assert.equal(parseAuthUrl(''), null);
  });
});

describe('media types', () => {
  it('normalizes picker/recorder mime types to what the bucket accepts', () => {
    assert.equal(normalizeMime('image/jpg', 'file.jpg', 'photo'), 'image/jpeg');
    assert.equal(normalizeMime(null, 'file:///x/photo.PNG', 'photo'), 'image/png');
    assert.equal(normalizeMime('image/heic', 'x', 'photo'), 'image/heic');
    assert.equal(normalizeMime(undefined, 'file:///x/rec.m4a', 'audio'), 'audio/mp4');
    assert.equal(normalizeMime('audio/x-m4a', 'x', 'audio'), 'audio/x-m4a');
    assert.equal(normalizeMime('video/mp4', 'x', 'photo'), 'image/jpeg');
  });
  it('derives kind, extension and storage path', () => {
    assert.equal(kindForMime('audio/mp4'), 'audio');
    assert.equal(kindForMime('image/png'), 'photo');
    assert.equal(extForMime('audio/mp4'), 'm4a');
    assert.equal(buildStoragePath('u1', 't1', 'm1', 'image/webp'), 'u1/t1/m1.webp');
  });
});

describe('geo + stats', () => {
  it('computes distances', () => {
    const a = { latitude: 28.6139, longitude: 77.209 };
    const b = { latitude: 28.7041, longitude: 77.1025 };
    const km = haversineM(a, b) / 1000;
    assert.ok(km > 13 && km < 15, `Delhi hop was ${km}`);
    assert.equal(pathLengthM([a]), 0);
  });
  it('ignores GPS teleports in path length', () => {
    const p = [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.01 }, { latitude: 50, longitude: 50 }];
    assert.ok(pathLengthM(p) < 2000);
  });
  it('summarizes a trip', () => {
    const s = summarize({
      entries: [
        { mood: '😊 Great', recorded_at: '2026-01-01' },
        { mood: '😊 Great', recorded_at: '2026-01-02' },
        { mood: '🔥 Epic', recorded_at: '2026-01-03' },
      ],
      expenses: [{ amount: 100 }, { amount: 50.5 }],
      packing: [{ packed: 1 }, { packed: 0 }],
      points: [],
    });
    assert.equal(s.topMood, '😊 Great');
    assert.equal(s.spendInr, 150.5);
    assert.deepEqual([s.packingDone, s.packingTotal, s.entryCount], [1, 2, 3]);
    assert.equal(s.lastEntryAt, '2026-01-03');
  });
});
