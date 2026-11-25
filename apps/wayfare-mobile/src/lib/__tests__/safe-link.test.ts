import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeSystemPath } from '../safeLink';

test('links that read safely open as they are', () => {
  assert.equal(safeSystemPath('/trip/abc-123'), '/trip/abc-123');
  assert.equal(safeSystemPath('wayfare://share/AbCd1234?x=1'), 'wayfare://share/AbCd1234?x=1');
  assert.equal(safeSystemPath('/place/%F0%9F%92%A9'), '/place/%F0%9F%92%A9');
});

test('a broken or absurd link goes home instead of an error screen', () => {
  assert.equal(safeSystemPath('/trip/%E0%A4%A'), '/');
  assert.equal(safeSystemPath('/join/x?t=%ZZ'), '/');
  assert.equal(safeSystemPath('/trip/' + 'x'.repeat(3000)), '/');
  assert.equal(safeSystemPath(''), '/');
});
