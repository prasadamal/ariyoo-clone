import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecordingLifecycle } from '../recordingLifecycle';
function setup(prepare: () => Promise<void> = async () => {}) {
  const calls: string[] = [];
  const lifecycle = createRecordingLifecycle<object>({
    permission: async () => true,
    enable: async () => { calls.push('enable'); }, disable: async () => { calls.push('disable'); },
    prepare: async () => { calls.push('prepare'); await prepare(); },
    record: () => { calls.push('record'); }, stop: async () => { calls.push('stop'); },
  });
  return { calls, lifecycle };
}
test('unmount during preparation never starts the microphone', async () => {
  let release!: () => void;
  let prepared!: () => void;
  const reached = new Promise<void>(resolve => { prepared = resolve; });
  const pending = new Promise<void>(resolve => { release = resolve; });
  const { calls, lifecycle } = setup(async () => { prepared(); await pending; });
  const recorder = {};
  const start = lifecycle.start(recorder);
  const rejected = assert.rejects(start, /cancelled/);
  await reached;
  const cancelled = lifecycle.cancel(recorder);
  release();
  await Promise.all([cancelled, rejected]);
  assert.ok(!calls.includes('record'));
  assert.equal(calls.filter(c => c === 'stop').length, 1);
  assert.equal(calls.at(-1), 'disable');
});
test('duplicate starts and saves cannot share the microphone or persist twice', async () => {
  const { lifecycle, calls } = setup();
  const recorder = {};
  await lifecycle.start(recorder);
  await assert.rejects(lifecycle.start({}), /already active/);
  let saved = 0;
  const save = lifecycle.save(recorder, async () => { saved++; });
  await assert.rejects(lifecycle.save(recorder, async () => { saved++; }), /ready to save/);
  await save;
  assert.equal(saved, 1);
  assert.equal(calls.filter(c => c === 'stop').length, 1);
});
test('cancellation invalidates a save waiting for the journal gate', async () => {
  const { lifecycle } = setup();
  const recorder = {};
  await lifecycle.start(recorder);
  let release!: () => void;
  let reached!: () => void;
  const ready = new Promise<void>(resolve => { reached = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  let saved = false;
  const saving = lifecycle.save(recorder, async current => { reached(); await wait; if (current()) saved = true; });
  await ready;
  await lifecycle.cancelActive();
  release();
  await saving;
  assert.equal(saved, false);
});
test('preparation failure releases the audio mode and permits retry', async () => {
  let fail = true;
  const { lifecycle, calls } = setup(async () => { if (fail) throw new Error('native failure'); });
  await assert.rejects(lifecycle.start({}), /native failure/);
  assert.equal(calls.at(-1), 'disable');
  fail = false;
  const recorder = {};
  await lifecycle.start(recorder);
  await lifecycle.cancel(recorder);
});
test('failed native stop retains ownership until a successful cleanup retry', async () => {
  let failed = false;
  const lifecycle = createRecordingLifecycle<object>({
    permission: async () => true, enable: async () => {}, disable: async () => {},
    prepare: async () => {}, record: () => {},
    stop: async () => { if (!failed) { failed = true; throw new Error('native stop failed'); } },
  });
  const recorder = {};
  await lifecycle.start(recorder);
  await assert.rejects(lifecycle.cancel(recorder), /native stop failed/);
  await assert.rejects(lifecycle.start({}), /already active/);
  await lifecycle.cancelActive();
  const next = {};
  await lifecycle.start(next);
  await lifecycle.cancel(next);
});
