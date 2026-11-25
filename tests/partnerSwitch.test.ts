import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPeople } from '../src/mocks/family.ts';
import {
  activePartners,
  initialTreeView,
  visibleTree,
  cycleTreePartner,
  toggleTreeChildren,
  focusTreePerson,
  previewPositions,
  partnerViewPositions,
  revealRelativeInTree,
} from '../src/mocks/familyView.ts';
import { addRelative } from '../src/mocks/addRelative.ts';
import type { DemoConnection } from '../src/types/index.ts';

const people = ['p', 'q', 'r', 'pq', 'pr', 'sp', 'sq', 'sr', 'grand'].map(
  (id) => ({ ...demoPeople[2], id, firstName: id }),
);
const connections: DemoConnection[] = [
  { id: 'pq', source: 'p', target: 'q', kind: 'partner' },
  { id: 'pr', source: 'p', target: 'r', kind: 'partner' },
  ...[
    ['p', 'pq'],
    ['q', 'pq'],
    ['p', 'pr'],
    ['r', 'pr'],
    ['p', 'sp'],
    ['q', 'sq'],
    ['r', 'sr'],
    ['pr', 'grand'],
  ].map(([source, target], index) => ({
    id: 'child' + index,
    source,
    target,
    kind: 'parent',
  })),
];
const initial = () => initialTreeView(people, connections);
const visible = (state: ReturnType<typeof initial>) =>
  visibleTree(people, connections, state).visible;
test('default partner shows only that couple children and each visible parent solo children', () => {
  assert.deepEqual(
    [...visible(initial())].sort(),
    ['p', 'q', 'pq', 'sp', 'sq'].sort(),
  );
});
test('switching partners replaces the shared branch including descendants', () => {
  const state = cycleTreePartner(people, connections, initial(), 'p', 1);
  assert.deepEqual(
    [...visible(state)].sort(),
    ['p', 'r', 'pr', 'sp', 'sr', 'grand'].sort(),
  );
  const selected = activePartners(people, connections, state);
  assert.equal(selected.p, 'r');
  assert.equal(selected.r, 'p');
  assert.equal(selected.q, undefined);
});
test('arrows wrap in both directions and return to the first partner', () => {
  const next = cycleTreePartner(people, connections, initial(), 'p', 1);
  assert.equal(
    activePartners(
      people,
      connections,
      cycleTreePartner(people, connections, next, 'p', 1),
    ).p,
    'q',
  );
  assert.equal(
    activePartners(
      people,
      connections,
      cycleTreePartner(people, connections, initial(), 'p', -1),
    ).p,
    'r',
  );
});
test('three partners cycle in order rather than acting as a two-way toggle', () => {
  const expandedPeople = [...people, { ...people[0], id: 's' }];
  const links = [
    ...connections,
    { id: 'ps', source: 'p', target: 's', kind: 'partner' },
  ];
  let state = initialTreeView(expandedPeople, links);
  for (const expected of ['r', 's', 'q']) {
    state = cycleTreePartner(expandedPeople, links, state, 'p', 1);
    assert.equal(activePartners(expandedPeople, links, state).p, expected);
  }
});
test('a partner with their own partners does not reopen the previous relationship', () => {
  const expandedPeople = [...people, { ...people[0], id: 's' }];
  const links = [
    ...connections,
    { id: 'qs', source: 'q', target: 's', kind: 'partner' },
  ];
  const state = cycleTreePartner(
    expandedPeople,
    links,
    initialTreeView(expandedPeople, links),
    'q',
    1,
  );
  const view = visibleTree(expandedPeople, links, state);
  assert.equal(view.visible.has('q'), true);
  assert.equal(view.visible.has('s'), true);
  assert.equal(view.visible.has('p'), false);
});
test('solo children stay visible even when couple children are collapsed', () => {
  const state = toggleTreeChildren(people, connections, initial(), 'p-q');
  assert.equal(visible(state).has('pq'), false);
  assert.equal(visible(state).has('sp'), true);
  assert.equal(visible(state).has('sq'), true);
  assert.equal(
    toggleTreeChildren(people, connections, state, 'p'),
    state,
    'Solo branch is always shown',
  );
});
test('solo children of a hidden partner are hidden, not attached to the other parent', () => {
  const state = cycleTreePartner(people, connections, initial(), 'p', 1);
  assert.equal(visible(state).has('sq'), false);
  assert.equal(visible(state).has('sr'), true);
});
test('couple collapse state is remembered across partner switches', () => {
  let state = toggleTreeChildren(people, connections, initial(), 'p-q');
  state = cycleTreePartner(people, connections, state, 'p', 1);
  assert.equal(visible(state).has('pr'), true);
  state = cycleTreePartner(people, connections, state, 'p', -1);
  assert.equal(visible(state).has('pq'), false);
  assert.equal(visible(state).has('sp'), true);
});
test('searching a hidden child selects its actual parent pair', () => {
  const state = focusTreePerson(people, connections, initial(), 'pr');
  assert.equal(activePartners(people, connections, state).p, 'r');
  assert.equal(visible(state).has('pr'), true);
  assert.equal(visible(state).has('q'), false);
});
test('new partner and child reveal the correct couple automatically', () => {
  const partner = addRelative(
    people,
    connections,
    'p',
    'partner',
    'Nowa Osoba',
  );
  let state = revealRelativeInTree(
    partner.people,
    partner.connections,
    initial(),
    { id: partner.person.id, relativeTo: 'p', kind: 'partner', token: '1' },
  );
  assert.equal(
    activePartners(partner.people, partner.connections, state).p,
    partner.person.id,
  );
  const child = addRelative(
    people,
    connections,
    'p',
    'child',
    'Nowe Dziecko',
    undefined,
    { coParentId: 'r' },
  );
  state = revealRelativeInTree(child.people, child.connections, initial(), {
    id: child.person.id,
    relativeTo: 'p',
    kind: 'child',
    token: '2',
  });
  assert.equal(activePartners(child.people, child.connections, state).p, 'r');
  assert.equal(
    visibleTree(child.people, child.connections, state).visible.has(
      child.person.id,
    ),
    true,
  );
});
test('partner uses the same visual slot and children stay on the next generation', () => {
  const base = previewPositions(people, connections, {});
  const state = cycleTreePartner(people, connections, initial(), 'p', 1);
  const points = partnerViewPositions(
    people,
    connections,
    state,
    visible(state),
    base,
  );
  assert.deepEqual(points.r, base.q);
  assert.equal(points.pr.y, points.p.y + 325);
  assert.equal(points.sp.y, points.pr.y);
  assert.notEqual(points.sp.x, points.pr.x);
});

test('focusing a visible person preserves the complete view unchanged', () => {
 const state = toggleTreeChildren(people, connections, initial(), 'p-q');
 assert.equal(focusTreePerson(people, connections, state, 'p'), state);
});
test('revealing a hidden child preserves unrelated collapsed branches and the anchor', () => {
 const state = {...initial(), collapsedFamilies: new Set(['p-q', 'unrelated']), openParents: new Set(['p','sq'])};
 const focused = focusTreePerson(people, connections, state, 'pq');
 assert.equal(focused.anchorId, state.anchorId);
 assert.ok(focused.collapsedFamilies.has('unrelated'));
 assert.ok(!focused.collapsedFamilies.has('p-q'));
 assert.ok(focused.openParents.has('sq'));
 assert.ok(visible(focused).has('pq'));
});
