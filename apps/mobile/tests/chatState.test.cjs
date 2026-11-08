const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const output = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/chatState.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, { exports: output });
const { chatReducer: reduce, initialChatState: initial } = output;
const message = id => ({ id, senderId: 1, createdAt: '2026-11-08T10:00:00Z', messageText: `message ${id}` });

test('socket arrival during history loading survives a later history snapshot', () => {
  let state = reduce(initial, { type: 'load', request: 1 });
  state = reduce(state, { type: 'received', message: message(2) });
  state = reduce(state, { type: 'loaded', request: 1, messages: [message(1)] });
  assert.equal(state.messages.map(m => m.id).join(','), '1,2');
});

test('HTTP acknowledgement plus repeated socket echo render only one message', () => {
  let state = initial;
  for (let i = 0; i < 3; i++) state = reduce(state, { type: 'received', message: message(1) });
  state = reduce(state, { type: 'loaded', request: 0, messages: [message(1)] });
  assert.equal(state.messages.length, 1);
});

test('old history success and failure cannot replace a newer request', () => {
  let state = reduce(initial, { type: 'load', request: 2 });
  state = reduce(state, { type: 'loaded', request: 2, messages: [message(2)] });
  assert.equal(reduce(state, { type: 'loaded', request: 1, messages: [message(1)] }), state);
  assert.equal(reduce(state, { type: 'loadFailed', request: 1, error: 'offline' }), state);
});

test('upload failure stays visible when the picker operation releases its lock', () => {
  let state = reduce(initial, { type: 'operation', operation: 'uploading' });
  state = reduce(state, { type: 'failed', error: 'Photo not sent' });
  state = reduce(state, { type: 'operation', operation: 'idle' });
  assert.equal(state.operation, 'idle');
  assert.equal(state.error, 'Photo not sent');
});

test('history retry preserves messages and clears the load failure', () => {
  let state = reduce(initial, { type: 'received', message: message(1) });
  state = reduce(state, { type: 'loadFailed', request: 0, error: 'offline' });
  state = reduce(state, { type: 'load', request: 1 });
  state = reduce(state, { type: 'loaded', request: 1, messages: [] });
  assert.equal(state.load, 'ready');
  assert.equal(state.error, null);
  assert.equal(state.messages.length, 1);
});
