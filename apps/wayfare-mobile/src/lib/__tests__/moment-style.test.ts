import assert from 'node:assert/strict';
import { test } from 'node:test';
import { foldsMoment, isShortMoment, moodTint, shortWeather } from '../momentStyle';

test('weather on a moment is an icon and the temperature', () => {
  assert.deepEqual(shortWeather('Partly cloudy, 29°C, wind 4 km/h'), { icon: 'weather-partly-cloudy', label: '29°' });
  assert.deepEqual(shortWeather('Clear, 21°C, wind 10 km/h'), { icon: 'weather-sunny', label: '21°' });
  assert.deepEqual(shortWeather('Light rain, -2.6°C'), { icon: 'weather-rainy', label: '-3°' });
  assert.deepEqual(shortWeather('Overcast'), { icon: 'weather-cloudy', label: 'Overcast' });
  assert.equal(shortWeather(''), null);
  assert.equal(shortWeather(null), null);
});

test('short words are set big; long ones fold', () => {
  assert.equal(isShortMoment('Woohoooo'), true);
  assert.equal(isShortMoment('Meghana again'), true);
  assert.equal(isShortMoment('We left home at 2 am the coffee had biryani'), false);
  assert.equal(isShortMoment('two\nlines'), false);
  assert.equal(foldsMoment('x'.repeat(221)), true);
  assert.equal(foldsMoment('a\nb\nc\nd\ne'), true);
  assert.equal(foldsMoment('Had dinner'), false);
});

test('a words-only moment takes its mood colour, in both themes', () => {
  assert.equal(moodTint('😊 Great', false).bg, '#e6f6ea');
  assert.equal(moodTint('🥹 Grateful', true).fg, '#f9c2d6');
  assert.equal(moodTint(null, false).bg, '#f1e4f9');
  assert.equal(moodTint('🤷 Unknown', false).bg, '#f1e4f9');
});
