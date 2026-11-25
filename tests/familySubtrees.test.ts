import test from 'node:test';
import assert from 'node:assert/strict';
import { familySubtreePositions } from '../src/mocks/familyLayout.ts';
import { familyGroups } from '../src/mocks/familyView.ts';
import type { Person, DemoConnection } from '../src/types/index.ts';
const people = [
  'p',
  'q',
  'a',
  'ap',
  'b',
  'bp',
  'c',
  'cp',
  'a1',
  'a2',
  'b1',
  'b2',
  'c1',
  'c2',
  'g1',
  'g2',
].map(
  (id) =>
    ({
      id,
      firstName: id,
      lastName: 'Test',
      maidenName: '',
      birth: '',
      death: '',
      birthPlace: '',
      residence: '',
      notes: '',
      portrait: 2,
    }) as Person,
);
const links: DemoConnection[] = [];
const link = (source: string, target: string, kind = 'parent') =>
  links.push({ id: String(links.length), source, target, kind });
for (const [a, b] of [
  ['p', 'q'],
  ['a', 'ap'],
  ['b', 'bp'],
  ['c', 'cp'],
  ['a1', 'a2'],
])
  link(a, b, 'partner');
for (const child of ['a', 'b', 'c']) {
  link('p', child);
  link('q', child);
}
for (const [father, mother, children] of [
  ['a', 'ap', ['a1', 'a2']],
  ['b', 'bp', ['b1', 'b2']],
  ['c', 'cp', ['c1', 'c2']],
] as [string, string, string[]][])
  for (const child of children) {
    link(father, child);
    link(mother, child);
  }
link('a1', 'g1');
link('a2', 'g1');
link('a1', 'g2');
link('a2', 'g2');
const state = {
  anchorId: 'a',
  openParents: new Set<string>(),
  collapsedFamilies: new Set<string>(),
  selectedPartners: {},
};
const base = Object.fromEntries(
  people.map((p, index) => [p.id, { x: index * 240, y: 40 }]),
);

test('parents are centered over their actual children, with separate sibling-family buses', () => {
  // Avoid a sibling partnership in this standard-tree fixture.
  const connections = links.filter(
    (l) => !(l.kind === 'partner' && l.source === 'a1'),
  );
  const points = familySubtreePositions(
    people,
    connections,
    state,
    new Set(people.map((p) => p.id)),
    base,
  );
  const groups = familyGroups(people, connections);
  const intervals = groups.map((group) => {
    const parentCenter =
      group.parents.reduce((sum, id) => sum + points[id].x + 90, 0) /
      group.parents.length;
    const xs = group.children.map((child) => points[child.id].x + 90);
    const left = Math.min(...xs),
      right = Math.max(...xs);
    assert.ok(
      Math.abs(parentCenter - (left + right) / 2) < 0.001,
      group.id + ' not centered',
    );
    return {
      id: group.id,
      left: Math.min(left, parentCenter),
      right: Math.max(right, parentCenter),
      row: points[group.parents[0]].y,
    };
  });
  for (const a of intervals)
    for (const b of intervals)
      if (a.id < b.id && a.row === b.row)
        assert.ok(
          a.right + 100 <= b.left || b.right + 100 <= a.left,
          'family buses overlap',
        );
});

test('collapsing a branch reserves only visible descendants and keeps pairs together', () => {
  const visible = new Set(
    people
      .filter((p) => !['b1', 'b2', 'g1', 'g2'].includes(p.id))
      .map((p) => p.id),
  );
  const points = familySubtreePositions(people, links, state, visible, base);
  for (const [a, b] of [
    ['p', 'q'],
    ['a', 'ap'],
    ['b', 'bp'],
    ['c', 'cp'],
  ]) {
    assert.equal(points[a].y, points[b].y);
    assert.equal(Math.abs(points[a].x - points[b].x), 240);
  }
});

test('the paternal and maternal branches enter a couple from their respective sides', () => {
  const ids = [
    'mother',
    'mf',
    'mm',
    'father',
    'ff',
    'fm',
    'child',
    'ancestor',
    'brother',
    'nephew',
    'sister',
  ];
  const fixture = ids.map((id) => ({
    ...people[0],
    id,
    gender: ['mother', 'mm', 'fm'].includes(id) ? 'Kobieta' : 'Mężczyzna',
  }));
  const relationships: DemoConnection[] = [
    ['mother', 'father', 'partner'],
    ['mm', 'mf', 'partner'],
    ['fm', 'ff', 'partner'],
    ['ff', 'father', 'parent'],
    ['fm', 'father', 'parent'],
    ['ff', 'brother', 'parent'],
    ['fm', 'brother', 'parent'],
    ['brother', 'nephew', 'parent'],
    ['mf', 'mother', 'parent'],
    ['mm', 'mother', 'parent'],
    ['mf', 'sister', 'parent'],
    ['mm', 'sister', 'parent'],
    ['ancestor', 'mf', 'parent'],
    ['father', 'child', 'parent'],
    ['mother', 'child', 'parent'],
  ].map(([source, target, kind], index) => ({
    id: String(index),
    source,
    target,
    kind,
  }));
  const positions = Object.fromEntries(
    ids.map((id, index) => [id, { x: index * 240, y: 40 }]),
  );
  const points = familySubtreePositions(
    fixture,
    relationships,
    { ...state, anchorId: 'father' },
    new Set(ids),
    positions,
  );
  assert.ok(points.father.x < points.mother.x);
  assert.ok(points.ff.x < points.fm.x && points.mf.x < points.mm.x);
  assert.ok(points.ff.x < points.father.x && points.mm.x > points.mother.x);
  assert.equal(points.ff.y, points.mf.y);
  assert.equal(points.brother.y, points.father.y);
  assert.equal(points.father.y - points.ff.y, 340);
  assert.ok(points.ancestor.y < points.mf.y);
  const paternalEnd = Math.max(
    (points.ff.x + points.fm.x) / 2,
    points.father.x,
    points.brother.x,
  );
  const maternalStart = Math.min(
    (points.mf.x + points.mm.x) / 2,
    points.mother.x,
    points.sister.x,
  );
  assert.ok(
    paternalEnd < maternalStart,
    'the two parental buses must not overlap',
  );
});

test('a wide lower generation does not push a short ancestral branch away from its child', () => {
  const children = Array.from({ length: 10 }, (_, index) => 'child-' + index);
  const ids = ['ff', 'father', 'mother', 'mf', ...children];
  const fixture = ids.map((id) => ({
    ...people[0],
    id,
    gender: id === 'mother' ? 'Kobieta' : 'Mężczyzna',
  }));
  const relations: DemoConnection[] = [
    ['father', 'mother', 'partner'],
    ['ff', 'father', 'parent'],
    ['mf', 'mother', 'parent'],
    ...children.flatMap((id) => [
      ['father', id, 'parent'],
      ['mother', id, 'parent'],
    ]),
  ].map(([source, target, kind], index) => ({
    id: String(index),
    source,
    target,
    kind,
  }));
  const points = familySubtreePositions(
    fixture,
    relations,
    { ...state, anchorId: 'father' },
    new Set(ids),
    Object.fromEntries(ids.map((id, index) => [id, { x: index * 240, y: 40 }])),
  );
  assert.ok(Math.abs(points.mf.x - points.mother.x) <= 120);
  assert.ok(Math.abs(points.ff.x - points.father.x) <= 120);
  assert.equal(points.ff.y, points.mf.y);
});
