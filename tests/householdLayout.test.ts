import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjacentPartnerPositions,
  partnerViewPositions,
  cycleTreePartner,
} from '../src/mocks/familyView.ts';
import type { Person, DemoConnection } from '../src/types/index.ts';
const person = (id: string): Person => ({
  id,
  firstName: id,
  lastName: 'Testowy',
  maidenName: '',
  birth: '',
  death: '',
  birthPlace: '',
  residence: '',
  notes: '',
  portrait: 2,
});
const people = ['a', 'b', 'c', 'ap', 'bp', 'cp', 'other'].map(person);
const links: DemoConnection[] = [
  ['a', 'ap'],
  ['b', 'bp'],
  ['c', 'cp'],
  ['a', 'other'],
].map(([source, target], index) => ({
  id: String(index),
  source,
  target,
  kind: 'partner',
}));
const state = () => ({
  anchorId: 'a',
  openParents: new Set<string>(),
  collapsedFamilies: new Set<string>(),
  selectedPartners: {},
});
const base = Object.fromEntries(
  people.map((p, index) => [p.id, { x: index * 240, y: 40 }]),
);
const visible = new Set(['a', 'b', 'c', 'ap', 'bp', 'cp']);

function checkCouples(points: typeof base, pairs: string[][], shown = visible) {
  for (const [a, b] of pairs) {
    assert.equal(points[a].y, points[b].y);
    assert.equal(Math.abs(points[a].x - points[b].x), 240);
    for (const id of shown) {
      if (id === a || id === b || points[id].y !== points[a].y) continue;
      assert.ok(
        points[id].x < Math.min(points[a].x, points[b].x) ||
          points[id].x > Math.max(points[a].x, points[b].x),
        `${id} splits ${a}/${b}`,
      );
      assert.ok(Math.abs(points[id].x - points[a].x) > 240);
      assert.ok(Math.abs(points[id].x - points[b].x) > 240);
    }
  }
}

test('each partner is closer than siblings, including three interleaved couples', () => {
  const before = structuredClone(base);
  const points = partnerViewPositions(people, links, state(), visible, base);
  checkCouples(points, [
    ['a', 'ap'],
    ['b', 'bp'],
    ['c', 'cp'],
  ]);
  assert.deepEqual(base, before, 'layout must not mutate saved positions');
  assert.equal(points.a.y, points.b.y, 'siblings retain their generation');
});

test('packing is deterministic and idempotent when render state changes', () => {
  const points = adjacentPartnerPositions(
    people,
    links,
    state(),
    visible,
    base,
  );
  assert.deepEqual(
    adjacentPartnerPositions(people, links, state(), visible, points),
    points,
  );
});

test('changing partner preserves the adjacent slot and does not use hidden cards as obstacles', () => {
  const original = partnerViewPositions(people, links, state(), visible, base);
  const switched = cycleTreePartner(people, links, state(), 'a', 1);
  const shown = new Set(['a', 'b', 'c', 'other', 'bp', 'cp']);
  const points = partnerViewPositions(people, links, switched, shown, base);
  assert.deepEqual(points.other, original.ap);
  checkCouples(
    points,
    [
      ['a', 'other'],
      ['b', 'bp'],
      ['c', 'cp'],
    ],
    shown,
  );
});

test('old manual coordinates cannot leave a partner on another row or behind a sibling', () => {
  const manual = { ...base, ap: { x: 1500, y: 500 } };
  const points = adjacentPartnerPositions(
    people,
    links,
    state(),
    visible,
    manual,
  );
  checkCouples(points, [
    ['a', 'ap'],
    ['b', 'bp'],
    ['c', 'cp'],
  ]);
});
