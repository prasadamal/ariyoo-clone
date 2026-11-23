import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayStripCells } from '../../features/trip/dayStripCells';

test('one cell per trip day, with the days that have moments marked', () => {
  const cells = dayStripCells('2026-11-28', '2026-11-30', ['2026-11-29']);
  assert.deepEqual(cells.map(c => [c.kind, c.n, c.day, c.hasMoments]), [
    ['day', 1, '2026-11-28', false],
    ['day', 2, '2026-11-29', true],
    ['day', 3, '2026-11-30', false],
  ]);
});

test('a one-day journey has no scroller', () => {
  assert.deepEqual(dayStripCells('2026-11-30', '2026-11-30', ['2026-11-30']), []);
  assert.deepEqual(dayStripCells('2026-11-30', null, ['2026-11-30']), []);
  assert.deepEqual(dayStripCells(null, null, []), []);
});

test('moments before or after the dates get one Before / After cell', () => {
  const cells = dayStripCells('2026-11-30', '2026-12-01', ['2026-11-20', '2026-11-22', '2026-12-05']);
  assert.deepEqual(cells.map(c => c.kind), ['before', 'day', 'day', 'after']);
  assert.equal(cells[0].day, '2026-11-22', 'Before jumps to the latest day before the trip');
  assert.equal(cells[3].day, '2026-12-05');
});

test('no dates: the trip runs from the first to the last moment; month ends roll over', () => {
  const cells = dayStripCells(null, null, ['2026-11-30', '2026-12-02']);
  assert.deepEqual(cells.map(c => c.day), ['2026-11-30', '2026-12-01', '2026-12-02']);
  assert.equal(dayStripCells('2026-01-01', '2027-12-31', []).length, 120, 'capped');
});
