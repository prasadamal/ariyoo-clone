import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiBase, checkRelease, envValue, type ReleaseInputs } from '../src/lib/release';
import { mergeSessions, sessionSubtitle } from '../src/lib/sessionList';
import { cleanTopic, emailProblem, hashtags, passwordProblem } from '../src/lib/validation';

test('placeholders and blanks count as unset', () => {
  for (const v of [undefined, null, '', '  ', 'https://YOUR_HOST/api', 'REPLACE_WITH_TEAM_ID', 'https://api.example.com', '00000000-0000-4000-8000-000000000000']) {
    assert.equal(envValue(v), undefined, String(v));
  }
  assert.equal(envValue(' https://api.real.app '), 'https://api.real.app');
});

test('API base URLs are normalised and must be http(s)', () => {
  assert.equal(apiBase('https://api.real.app//'), 'https://api.real.app');
  assert.equal(apiBase('http://192.168.1.20:5296'), 'http://192.168.1.20:5296');
  assert.equal(apiBase('api.real.app'), undefined);
  assert.equal(apiBase(''), undefined);
});

const ready: ReleaseInputs = {
  env: { EXPO_PUBLIC_API_URL: 'https://api.real.app' },
  eas: { submit: { production: { ios: { appleId: 'owner@icloud.test', ascAppId: '6700000000', appleTeamId: 'ABCDE12345' } } } },
  easProjectId: '12345678-1234-1234-1234-123456789abc',
  hasGoogleServices: true,
};
const errors = (i: ReleaseInputs) => checkRelease(i).filter(p => p.level === 'error').map(p => p.message).join('\n');

test('release preflight passes only a fully configured build', () => {
  assert.deepEqual(checkRelease(ready), []);
  const committed: ReleaseInputs = {
    env: {},
    eas: { submit: { production: { ios: { appleId: 'REPLACE_WITH_APPLE_ID_EMAIL', ascAppId: 'REPLACE_WITH_ASC_APP_ID', appleTeamId: 'REPLACE_WITH_TEAM_ID' } } } },
    easProjectId: '',
    hasGoogleServices: false,
  };
  assert.match(errors(committed), /EAS project id/);
  assert.match(errors(committed), /EXPO_PUBLIC_API_URL is not set/);
  assert.equal(checkRelease(committed).filter(p => p.level === 'warning').length, 2);
  assert.match(errors({ ...ready, env: { EXPO_PUBLIC_API_URL: 'http://api.real.app' } }), /public https/);
  assert.match(errors({ ...ready, env: { EXPO_PUBLIC_API_URL: 'https://localhost:5296' } }), /public https/);
  assert.match(errors({ ...ready, easProjectId: '00000000-0000-4000-8000-000000000000' }), /EAS project id/);
});

test('sign-up checks mirror the server', () => {
  assert.match(passwordProblem('short') ?? '', /at least 12/);
  assert.equal(passwordProblem('a long enough passphrase'), null);
  assert.match(passwordProblem('x'.repeat(73)) ?? '', /at most 72/);
  // 25 four-byte characters are 100 bytes, over the limit even though the count looks fine.
  assert.match(passwordProblem('😀'.repeat(25)) ?? '', /at most 72/);
  assert.equal(emailProblem(' someone@mail.test '), null);
  assert.ok(emailProblem('someone@mail'));
  assert.ok(emailProblem('not an email'));
});

test('topics and hashtags are cleaned consistently', () => {
  assert.equal(cleanTopic('  #Street   Food '), 'street food');
  assert.equal(cleanTopic('കേരളം'), 'കേരളം');
  assert.equal(cleanTopic('a'), null);
  assert.equal(cleanTopic('<script>'), null);
  assert.equal(cleanTopic('x'.repeat(41)), null);
  assert.deepEqual(hashtags('Quiet beaches? #Goa #beaches and #goa again, not # alone'), ['goa', 'beaches']);
  assert.deepEqual(hashtags('no tags here'), []);
  assert.deepEqual(hashtags('ഓണം എവിടെ? #കേരളം'), ['കേരളം']);
});

test('conversation list merges both roles, newest first, with clear status lines', () => {
  const asked = [
    { sessionId: 1, title: 'a', active: true, role: 'seeker' as const, waiting: true, updatedAt: '2026-11-10T10:00:00Z' },
    { sessionId: 2, title: 'b', active: true, role: 'seeker' as const, waiting: false, peerName: 'Asha', updatedAt: '2026-11-12T10:00:00Z' },
  ];
  const answering = [
    { sessionId: 3, title: 'c', active: true, role: 'solver' as const, peerName: 'Ravi', updatedAt: '2026-11-11T10:00:00Z' },
    { sessionId: 2, title: 'dup', active: true, role: 'solver' as const },
    { sessionId: 4, title: 'd', active: false, role: 'solver' as const },
  ];
  const merged = mergeSessions(asked, answering);
  assert.deepEqual(merged.map(s => s.sessionId), [2, 3, 1, 4]);
  assert.equal(merged[0].title, 'b');
  assert.deepEqual(merged.map(sessionSubtitle), ['Answered by Asha', 'You are answering Ravi', 'Waiting for an expert', 'Closed']);
});
