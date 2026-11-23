import assert from 'node:assert/strict';
import { test } from 'node:test';
import { monthGrid, writingStreak } from '../../features/diary/moodCalendarRules';

const at = (day: string, mood: string | null = null, time = '10:00') => ({ recorded_at: new Date(`${day}T${time}:00`).toISOString(), mood });

test('streak counts days in a row up to today, or yesterday if today is still blank', () => {
  const e = [at('2026-11-20'), at('2026-11-21'), at('2026-11-22'), at('2026-11-18')];
  assert.equal(writingStreak(e, '2026-11-22'), 3);
  assert.equal(writingStreak(e, '2026-11-23'), 3, 'today not written yet: the streak still stands');
  assert.equal(writingStreak(e, '2026-11-24'), 0, 'a missed day breaks it');
  assert.equal(writingStreak([], '2026-11-24'), 0);
});

test('month grid: Monday first, first mood of each day, written and future flags', () => {
  const weeks = monthGrid(2026, 10, [at('2026-11-02', '😊 Great', '09:00'), at('2026-11-02', '😴 Tired', '22:00'), at('2026-11-03')], '2026-11-24');
  assert.ok(weeks.every(w => w.length === 7));
  // 1 Nov 2026 is a Sunday: six blanks before it.
  assert.equal(weeks[0].findIndex(c => c.date === 1), 6);
  const nov2 = weeks.flat().find(c => c.date === 2)!;
  assert.equal(nov2.emoji, '😊');
  assert.equal(weeks.flat().find(c => c.date === 3)!.written, true);
  assert.equal(weeks.flat().find(c => c.date === 3)!.emoji, null);
  assert.equal(weeks.flat().find(c => c.date === 25)!.future, true);
  assert.equal(weeks.flat().filter(c => c.date).length, 30);
});
