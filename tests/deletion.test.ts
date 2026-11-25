import test from 'node:test';
import assert from 'node:assert/strict';
import { deletionImpact } from '../src/mocks/deletion.ts';
import type { Person, DemoConnection } from '../src/types/index.ts';
const people = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }) as Person);
const links = (pairs: string[][]): DemoConnection[] =>
  pairs.map(([source, target], index) => ({
    id: String(index),
    source,
    target,
    kind: 'parent',
  }));
test('deleting a bridge or the only relative is blocked', () => {
  assert.deepEqual(
    new Set(
      deletionImpact(
        people,
        links([
          ['a', 'b'],
          ['b', 'c'],
          ['c', 'd'],
        ]),
        'b',
      ),
    ),
    new Set(['a', 'c']),
  );
  assert.deepEqual(deletionImpact(people, links([['a', 'b']]), 'a'), ['b']);
});
test('leaves with a connected remaining family can be deleted', () => {
  assert.deepEqual(
    deletionImpact(
      people,
      links([
        ['a', 'b'],
        ['b', 'c'],
      ]),
      'c',
    ),
    [],
  );
});
test('alternate family paths preserve connectivity and pre-existing isolates do not block deletion', () => {
  assert.deepEqual(
    deletionImpact(
      people,
      links([
        ['a', 'b'],
        ['b', 'c'],
        ['a', 'c'],
      ]),
      'b',
    ),
    [],
  );
  assert.deepEqual(deletionImpact(people, links([['a', 'b']]), 'e'), []);
});


test('blocked deletion names only one nearest person per detached branch', () => {
  const result = deletionImpact(people, links([['a','b'],['a','c'],['b','c'],['c','d'],['a','e']]), 'a');
  assert.deepEqual(result, ['b','e']);
  assert.ok(!result.includes('d'), 'a more distant relative must not appear');
  assert.ok(!result.includes('c'), 'the same connected branch must not be listed twice');
});
