import assert from 'node:assert/strict';
import test from 'node:test';
import { canEditTrip, cleanHandle, isSharedTrip, personName, tripRole, validHandle } from '../crewRules';
import { typingMention } from '../mentions';

test('a journey with no role recorded is yours', () => {
  assert.equal(tripRole({ my_role: null }), 'owner');
  assert.equal(tripRole({ my_role: 'admin' }), 'admin');
  assert.equal(tripRole({ my_role: 'member' }), 'member');
});

test('owner and admins change things, members only look', () => {
  assert.equal(canEditTrip({ my_role: null }), true);
  assert.equal(canEditTrip({ my_role: 'admin' }), true);
  assert.equal(canEditTrip({ my_role: 'member' }), false);
});

test('shared means someone else started it, or it has crew besides you', () => {
  assert.equal(isSharedTrip({ owner_id: null, crew_count: 0 }), false);
  assert.equal(isSharedTrip({ owner_id: null, crew_count: 1 }), false);
  assert.equal(isSharedTrip({ owner_id: null, crew_count: 3 }), true);
  assert.equal(isSharedTrip({ owner_id: 'u1', crew_count: 0 }), true);
});

test('usernames are cleaned and checked like the server does', () => {
  assert.equal(cleanHandle(' @@Anna.K '), 'anna.k');
  assert.equal(validHandle('anna.k'), true);
  assert.equal(validHandle('an'), false);
  assert.equal(validHandle('anna k'), false);
  assert.equal(validHandle('a'.repeat(25)), false);
});

test('names fall back to the username', () => {
  assert.equal(personName({ display_name: 'Anna', username: 'anna' }), 'Anna');
  assert.equal(personName({ display_name: null, username: 'anna' }), '@anna');
  assert.equal(personName({ display_name: null, username: null }), 'Traveller');
});

test('the @word being typed is offered for completion', () => {
  assert.equal(typingMention('see you @an'), 'an');
  assert.equal(typingMention('@'), '');
  assert.equal(typingMention('Hi @Anna'), 'anna');
  assert.equal(typingMention('mail me at a@b'), null);
  assert.equal(typingMention('@anna done'), null);
});
