import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sortPlan } from '../../features/trip/planRules';

test('a day plan runs in time order, untimed plans last in the order added', () => {
  const items = [
    { id: 'a', start_time: null, sort_order: 0 },
    { id: 'b', start_time: '18:00', sort_order: 1 },
    { id: 'c', start_time: '06:30', sort_order: 2 },
    { id: 'd', start_time: null, sort_order: 3 },
  ];
  assert.deepEqual(sortPlan(items).map(i => i.id), ['c', 'b', 'a', 'd']);
});
