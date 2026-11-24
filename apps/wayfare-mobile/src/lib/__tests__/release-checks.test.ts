import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkRelease, type ReleaseInputs } from '../releaseChecks';

const webConfig = (url: string, key: string) => `window.WAYFARE_CONFIG = {\n  supabaseUrl: '${url}',\n  supabaseAnonKey: '${key}',\n};`;

const ready: ReleaseInputs = {
  env: {
    EXPO_PUBLIC_SUPABASE_URL: 'https://abcd1234.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_real',
  },
  eas: { submit: { production: { ios: { appleId: 'owner@icloud.test', ascAppId: '6700000000', appleTeamId: 'ABCDE12345' } } } },
  webConfig: webConfig('https://abcd1234.supabase.co', 'sb_publishable_real'),
  hasGoogleServices: true,
  easProjectId: '12345678-1234-1234-1234-123456789abc',
};

const errors = (i: ReleaseInputs) => checkRelease(i).filter(p => p.level === 'error').map(p => p.message);
const warnings = (i: ReleaseInputs) => checkRelease(i).filter(p => p.level === 'warning');

test('a fully configured release has nothing to report', () => {
  assert.deepEqual(checkRelease(ready), []);
});

test('the repository as committed is not ready, and says why', () => {
  const committed: ReleaseInputs = {
    env: {},
    eas: { submit: { production: { ios: { appleId: 'REPLACE_WITH_APPLE_ID_EMAIL', ascAppId: 'REPLACE_WITH_ASC_APP_ID', appleTeamId: 'REPLACE_WITH_TEAM_ID' } } } },
    webConfig: webConfig('https://YOUR_PROJECT.supabase.co', 'YOUR_ANON_KEY'),
    hasGoogleServices: false,
    easProjectId: '',
  };
  const found = errors(committed).join('\n');
  assert.match(found, /EAS project id/);
  assert.match(found, /SUPABASE/);
  assert.match(found, /wayfare-config\.js still has placeholders/);
  assert.equal(warnings(committed).length, 2);
});

test('placeholder and insecure backend values are errors', () => {
  assert.match(errors({ ...ready, env: { ...ready.env, EXPO_PUBLIC_SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co' } }).join(), /not set/);
  assert.match(errors({ ...ready, env: { ...ready.env, EXPO_PUBLIC_SUPABASE_URL: 'http://abcd1234.supabase.co' }, webConfig: webConfig('http://abcd1234.supabase.co', 'k') }).join(), /https/);
});

test('web viewers must use the same project as the app', () => {
  assert.match(errors({ ...ready, webConfig: webConfig('https://other9999.supabase.co', 'sb_publishable_real') }).join(), /different Supabase project/);
});

test('custom viewer URLs must be https', () => {
  assert.match(errors({ ...ready, env: { ...ready.env, EXPO_PUBLIC_WAYFARE_LIVE_BASE: 'http://example.test/live' } }).join(), /EXPO_PUBLIC_WAYFARE_LIVE_BASE/);
  assert.deepEqual(errors({ ...ready, env: { ...ready.env, EXPO_PUBLIC_WAYFARE_LIVE_BASE: 'https://example.test/live' } }), []);
});
