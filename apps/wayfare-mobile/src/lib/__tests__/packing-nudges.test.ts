import assert from 'node:assert/strict';
import test from 'node:test';
import { nudgeContent, nudgePlan, tripForecast, weatherTip } from '../packingNudges';

const day = (date: string, o: Partial<{ code: number; maxC: number; minC: number; precipChance: number }> = {}) => ({
  date, code: o.code ?? 1, maxC: o.maxC ?? 26, minC: o.minC ?? 16, precipChance: o.precipChance ?? 0, sunrise: null, sunset: null,
});

test('two nudges: 9 am three days before, 7 pm the evening before; past ones dropped', () => {
  const plan = nudgePlan('2026-12-15', new Date(2026, 10, 24, 12));
  assert.deepEqual(plan.map(p => p.kind), ['three-days', 'evening-before']);
  assert.equal(plan[0].at.getDate(), 12);
  assert.equal(plan[0].at.getHours(), 9);
  assert.equal(plan[1].at.getDate(), 14);
  assert.equal(plan[1].at.getHours(), 19);
  assert.deepEqual(nudgePlan('2026-12-15', new Date(2026, 11, 13, 12)).map(p => p.kind), ['evening-before'], 'three-day nudge already passed');
  assert.deepEqual(nudgePlan('2026-12-15', new Date(2026, 11, 15, 8)), [], 'trip day: nothing left');
  assert.deepEqual(nudgePlan('nonsense'), []);
});

test('weather tip: rain first, then snow, cold, heat; nothing for mild weather', () => {
  assert.deepEqual(weatherTip([day('a'), day('b', { precipChance: 70 })]), { item: 'Rain jacket', why: 'Rain is likely on Day 2 (70%).' });
  assert.equal(weatherTip([day('a', { code: 73, minC: -4 })])!.item, 'Warm gloves');
  assert.equal(weatherTip([day('a', { minC: 6 })])!.item, 'Warm layer');
  assert.equal(weatherTip([day('a', { maxC: 35 })])!.item, 'Sunscreen');
  assert.equal(weatherTip([day('a'), day('b')]), null);
});

test('notification text says when, how much is left, and the tip', () => {
  const tip = { item: 'Rain jacket', why: 'Rain is likely on Day 2 (70%).' };
  assert.deepEqual(nudgeContent('three-days', 'Ha Giang loop', 12, tip), { title: 'Ha Giang loop in 3 days', body: '12 things left to pack. Rain is likely on Day 2 (70%): pack a rain jacket.' });
  assert.equal(nudgeContent('evening-before', 'Goa', 1, null).title, 'Goa tomorrow');
  assert.equal(nudgeContent('evening-before', 'Goa', 1, null).body, '1 thing left to pack.');
  assert.equal(nudgeContent('evening-before', 'Goa', 0, null).body, 'Everything is packed. Nice.');
});

test('forecast is trimmed to the trip days', () => {
  const f = [day('2026-12-14'), day('2026-12-16'), day('2026-12-15'), day('2026-12-23')];
  assert.deepEqual(tripForecast(f, '2026-12-15', '2026-12-22').map(d => d.date), ['2026-12-15', '2026-12-16']);
  assert.deepEqual(tripForecast(f, '2026-12-15', null).map(d => d.date), ['2026-12-15']);
});
