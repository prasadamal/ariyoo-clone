import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchJournal, snippet } from '../journalSearch';

const trips = [
  { id: 't1', title: 'Kochi food trail', destination: 'Kochi', trip_type: 'city' },
  { id: 'd', title: 'Everyday journal', destination: null, trip_type: 'everyday' },
];
const entries = [
  { id: 'a', trip_id: 't1', recorded_at: '2026-11-20T10:00:00Z', body: 'Best **appam** at a tiny café near the ferry', place_name: 'Fort Kochi', mood: '😊 Great' },
  { id: 'b', trip_id: 't1', recorded_at: '2026-11-21T10:00:00Z', body: 'Rain all day', place_name: null, mood: null },
  { id: 'c', trip_id: 'd', recorded_at: '2026-11-22T10:00:00Z', body: 'Dreamt about the café again', place_name: null, mood: null },
];

test('finds moments by words, place or mood, newest first, ignoring formatting and accents', () => {
  const hits = searchJournal(entries, trips, 'cafe');
  assert.deepEqual(hits.map(h => h.id), ['c', 'a']);
  assert.equal(hits[0].kind === 'moment' && hits[0].tripTitle, 'Diary');
  assert.deepEqual(searchJournal(entries, trips, 'appam').map(h => h.id), ['a'], 'bold marks are ignored');
  assert.deepEqual(searchJournal(entries, trips, 'fort').map(h => h.id), ['a'], 'place names count');
  assert.deepEqual(searchJournal(entries, trips, 'great').map(h => h.id), ['a'], 'moods count');
});

test('journeys match by title or destination; every word must match', () => {
  assert.deepEqual(searchJournal(entries, trips, 'kochi').map(h => h.id), ['t1', 'a']);
  assert.deepEqual(searchJournal(entries, trips, 'rain ferry'), []);
  assert.deepEqual(searchJournal(entries, trips, 'a'), [], 'one letter is too short');
});

test('snippets centre on the match', () => {
  assert.equal(snippet('x'.repeat(100) + ' hello ' + 'y'.repeat(100), 'hello', 5), '…xxxx hello yyyy…');
});
