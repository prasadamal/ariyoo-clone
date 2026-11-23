import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sketchPath } from '../routeSketch';

test('a route fits inside the box with padding', () => {
  const r = sketchPath([{ latitude: 12.97, longitude: 77.59 }, { latitude: 13.37, longitude: 77.68 }, { latitude: 13.0, longitude: 77.9 }], 300, 180, 16);
  assert.ok(r);
  const nums = r!.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  for (let i = 0; i < nums.length; i += 2) {
    assert.ok(nums[i] >= 15.9 && nums[i] <= 284.1, `x ${nums[i]}`);
    assert.ok(nums[i + 1] >= 15.9 && nums[i + 1] <= 164.1, `y ${nums[i + 1]}`);
  }
  assert.ok(r!.start.y > r!.end.y - 200, 'north is up: the northern point is higher');
});

test('too few points: nothing to draw', () => {
  assert.equal(sketchPath([{ latitude: 1, longitude: 1 }], 300, 180), null);
  assert.equal(sketchPath([], 300, 180), null);
});
