import assert from 'node:assert/strict';
import test from 'node:test';
import { typeTime } from '../timeInput';

test('plan times accept only a real 24-hour time', () => {
  assert.equal(typeTime('abc'), '');
  assert.equal(typeTime('0630'), '06:30');
  assert.equal(typeTime('630'), '06:30');
  assert.equal(typeTime('17:45'), '17:45');
  assert.equal(typeTime('1745pm'), '17:45');
  assert.equal(typeTime('25'), '2');
  assert.equal(typeTime('1270'), '12');
  assert.equal(typeTime('1205'), '12:05');
  assert.equal(typeTime('06'), '06');
  assert.equal(typeTime('7'), '07');
});
