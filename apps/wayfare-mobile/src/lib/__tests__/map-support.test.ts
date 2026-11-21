import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapsSupported } from '../mapSupport';

test('Android draws a map only when a Google Maps key is built in (the missing key was crashing the Route tab)', () => {
  assert.equal(mapsSupported('android', ''), false);
  assert.equal(mapsSupported('android', '   '), false);
  assert.equal(mapsSupported('android', undefined), false);
  assert.equal(mapsSupported('android', 'AIza-example-key'), true);
});

test('iPhones always can, and the browser preview never draws the native map', () => {
  assert.equal(mapsSupported('ios', ''), true);
  assert.equal(mapsSupported('web', 'AIza-example-key'), false);
});
