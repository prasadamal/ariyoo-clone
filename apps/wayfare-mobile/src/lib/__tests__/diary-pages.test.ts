import assert from 'node:assert/strict';
import test from 'node:test';
import { dayOf, diaryPages, diarySheets, pageIndexFor, todayPageKeys } from '../../features/diary/diaryPages';

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

test('several pages today (newest first), then earlier days as single sheets', () => {
  const e = (id: string, day: string, time = '10:00') => ({ id, ...at(day, time) });
  const entries = [e('a', '2026-11-22', '08:00'), e('b', '2026-11-22', '13:00'), e('c', '2026-11-20')];
  const keys = todayPageKeys(entries, '2026-11-22');
  assert.deepEqual(keys, ['a', 'b']);
  const sheets = diarySheets(entries, '2026-11-22', [...keys, 'new-1']);
  assert.deepEqual(sheets.map(s => [s.key, s.editable, s.page, s.pages]), [
    ['new-1', true, 3, 3],
    ['b', true, 2, 3],
    ['a', true, 1, 3],
    ['day-2026-11-20', false, 1, 1],
  ]);
  assert.equal(sheets[1].entry?.id, 'b');
  assert.deepEqual(todayPageKeys([], '2026-11-22'), ['new-0'], 'a blank page when nothing is written yet');
});
