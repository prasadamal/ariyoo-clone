import assert from 'node:assert/strict';
import { test } from 'node:test';
import { envValue, isUsableSupabaseConfig } from '../envValue';

test('blank and placeholder values count as unset', () => {
  assert.equal(envValue(undefined), undefined);
  assert.equal(envValue(null), undefined);
  assert.equal(envValue(''), undefined);
  assert.equal(envValue('   '), undefined);
  assert.equal(envValue('https://YOUR_PROJECT.supabase.co'), undefined);
  assert.equal(envValue('YOUR_ANON_KEY'), undefined);
  assert.equal(envValue('your-anon-key'), undefined);
  assert.equal(envValue('REPLACE_WITH_APPLE_ID_EMAIL'), undefined);
});

test('real values pass through trimmed', () => {
  assert.equal(envValue(' https://abcd1234.supabase.co '), 'https://abcd1234.supabase.co');
  const jwtLike = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl_your-token';
  assert.equal(envValue(jwtLike), jwtLike);
  assert.equal(envValue('https://example.github.io/wayfare-share/index.html'), 'https://example.github.io/wayfare-share/index.html');
});

test('supabase config needs an http(s) URL and a key', () => {
  assert.equal(isUsableSupabaseConfig('https://abcd1234.supabase.co', 'key'), true);
  assert.equal(isUsableSupabaseConfig('http://127.0.0.1:54321', 'key'), true);
  assert.equal(isUsableSupabaseConfig('', 'key'), false);
  assert.equal(isUsableSupabaseConfig('abcd1234.supabase.co', 'key'), false);
  assert.equal(isUsableSupabaseConfig('https://abcd1234.supabase.co', ''), false);
});
