import assert from 'node:assert/strict';
import test from 'node:test';
import { capitalizeName, capitalizeWords, firstName } from '../names';

test('every word of a name starts with a capital, as typed', () => {
  assert.equal(capitalizeWords('amal prasad'), 'Amal Prasad');
  assert.equal(capitalizeWords('amal, joe , jazir'), 'Amal, Joe , Jazir');
  assert.equal(capitalizeWords('McDonald o’neil'), 'McDonald O’neil');
  assert.equal(capitalizeWords('éva'), 'Éva');
  assert.equal(capitalizeWords(''), '');
});

test('names are tidied', () => {
  assert.equal(capitalizeName('  akshay   kollamakkal  '), 'Akshay Kollamakkal');
});

test('long names shrink to a first name', () => {
  assert.equal(firstName('Akshay Kollamakkal Ramachandran'), 'Akshay');
  assert.equal(firstName('Venkatanarasimharajuvaripeta Rao'), 'Venkatanara…');
  assert.equal(firstName('Joe'), 'Joe');
});
