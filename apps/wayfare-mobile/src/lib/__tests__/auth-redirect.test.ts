import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newPasswordProblem, parseAuthRedirect } from '../authRedirect';

test('reads recovery tokens from the link fragment', () => {
  assert.deepEqual(parseAuthRedirect('wayfare://reset-password#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=recovery'), {
    kind: 'tokens', accessToken: 'a.b.c', refreshToken: 'r1', type: 'recovery',
  });
  // Expo Go style URL
  assert.equal(parseAuthRedirect('exp://192.168.1.2:8081/--/reset-password#access_token=x&refresh_token=y').kind, 'tokens');
});

test('expired or used links become a friendly error', () => {
  const r = parseAuthRedirect('wayfare://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  assert.equal(r.kind, 'error');
  assert.match((r as { message: string }).message, /expired or was already used/);
  assert.equal(parseAuthRedirect('wayfare://reset-password?error=server_error').kind, 'error');
});

test('PKCE code and empty links', () => {
  assert.deepEqual(parseAuthRedirect('wayfare://reset-password?code=abc123'), { kind: 'code', code: 'abc123' });
  assert.deepEqual(parseAuthRedirect('wayfare://reset-password'), { kind: 'none' });
  assert.deepEqual(parseAuthRedirect(null), { kind: 'none' });
  // a token without its refresh partner is not enough
  assert.deepEqual(parseAuthRedirect('wayfare://reset-password#access_token=x'), { kind: 'none' });
});

test('new password rules', () => {
  assert.equal(newPasswordProblem('short', ''), '3 more characters needed');
  assert.equal(newPasswordProblem('longenough', ''), 'Type the new password again');
  assert.equal(newPasswordProblem('longenough', 'longenougX'), 'Passwords don’t match');
  assert.equal(newPasswordProblem('longenough', 'longenough'), null);
});
