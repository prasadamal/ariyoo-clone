import assert from 'node:assert/strict';
import test from 'node:test';
import { bodyWithTranscripts, splitTranscripts, transcriptFrom } from '../transcript';

test('transcript joins finished phrases and the one still being heard', () => {
  assert.equal(transcriptFrom(['Mist everywhere this morning.', ' The manager made us chai '], 'on a wood'), 'Mist everywhere this morning. The manager made us chai on a wood');
  assert.equal(transcriptFrom([], ''), '');
});

test('a moment keeps what you typed, then each voice note on a 🎙 line', () => {
  assert.equal(bodyWithTranscripts('Top Station', ['Mist everywhere', 'Chai on a wood stove']), 'Top Station\n🎙 Mist everywhere\n🎙 Chai on a wood stove');
  assert.equal(bodyWithTranscripts('', ['Chai']), '🎙 Chai');
  assert.equal(bodyWithTranscripts('Just text', [undefined, '  ']), 'Just text');
  assert.equal(bodyWithTranscripts('', []), null, 'nothing: the caller picks a placeholder');
  assert.deepEqual(splitTranscripts('Top Station\n🎙 Mist everywhere\n🎙 Chai'), { typed: 'Top Station', said: ['Mist everywhere', 'Chai'] });
});
