/** Pure merge helper smoke test (no Expo / Supabase). */
function newer(localIso, remoteIso) {
  return new Date(remoteIso).getTime() > new Date(localIso).getTime();
}

let failed = 0;
function assert(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else {
    console.log('ok', name);
  }
}

assert('remote newer wins', newer('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'));
assert('local newer blocks pull', !newer('2026-01-03T00:00:00Z', '2026-01-02T00:00:00Z'));

if (failed) process.exit(1);
console.log('sync-merge-smoke passed');
