import assert from 'node:assert/strict';
import test from 'node:test';
import { dayOf, diaryPages, pageIndexFor } from '../../features/diary/diaryPages';

const at = (day: string, time = '10:00') => ({ recorded_at: new Date(`${day}T${time}:00`).toISOString() });

test('today first (even blank), then written days newest first, never the future', () => {
  const pages = diaryPages([at('2026-11-20'), at('2026-11-22', '09:00'), at('2026-11-18'), at('2026-11-25'), at('2026-11-20', '21:00')], '2026-11-22');
  assert.deepEqual(pages.map(p => p.day), ['2026-11-22', '2026-11-20', '2026-11-18']);
  assert.equal(pages[1].entries.length, 2);
  assert.deepEqual(diaryPages([], '2026-11-22').map(p => p.day), ['2026-11-22']);
});

test('going to a date lands on that page, or the nearest earlier one', () => {
  const pages = [{ day: '2026-11-22' }, { day: '2026-11-20' }, { day: '2026-11-18' }];
  assert.deepEqual(pageIndexFor(pages, '2026-11-20'), { index: 1, exact: true });
  assert.deepEqual(pageIndexFor(pages, '2026-11-19'), { index: 2, exact: false });
  assert.deepEqual(pageIndexFor(pages, '2026-01-01'), { index: 2, exact: false });
});

test('days are local calendar days', () => {
  assert.equal(dayOf(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
