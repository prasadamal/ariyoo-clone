import assert from 'node:assert/strict';
import test from 'node:test';
import { mentionedUsernames, splitMentions } from '../mentions';

test('finds @mentions and leaves emails and short handles alone', () => {
  assert.deepEqual(mentionedUsernames('Biryani with @arif and @Anna.k. Mail me at amal@example.com, @ab'), ['arif', 'anna.k']);
  const parts = splitMentions('Hi @arif!');
  assert.deepEqual(parts, [{ text: 'Hi ' }, { text: '@arif', mention: 'arif' }, { text: '!' }]);
  assert.equal(splitMentions('no mentions').length, 1);
  assert.equal(splitMentions('@start of text')[0].mention, 'start');
});
