import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sharedMessage, stopMessage, storyShareId } from '../storyLink';

test('turning sharing on makes a new link; re-sending a live link keeps it', () => {
  const mint = () => 'fresh-id-0001';
  assert.equal(storyShareId({ visibility: 'private', share_id: 'old-id-0001' }, mint), 'fresh-id-0001', 'a stopped link is never reused');
  assert.equal(storyShareId({ visibility: 'private', share_id: null }, mint), 'fresh-id-0001');
  assert.equal(storyShareId({ visibility: 'link', share_id: 'live-id-0001' }, mint), 'live-id-0001');
});

test('stopping only claims the link is dead once the server confirmed it', () => {
  assert.match(stopMessage('stopped'), /no longer opens/);
  assert.match(stopMessage('stopped'), /may have saved/);
  assert.match(stopMessage('pending'), /still opens/);
  assert.doesNotMatch(stopMessage('pending'), /no longer opens/);
});

test('a story with uploads still waiting says so', () => {
  assert.equal(sharedMessage(0), null);
  assert.match(sharedMessage(1) ?? '', /1 moment or photo is still uploading/);
  assert.match(sharedMessage(3) ?? '', /3 moments or photos are/);
});
