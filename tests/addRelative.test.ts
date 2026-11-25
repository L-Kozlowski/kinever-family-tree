import test from 'node:test';
import assert from 'node:assert/strict';
import { addRelative, relationContext } from '../src/mocks/addRelative.ts';
import {
  demoPeople,
  demoConnections,
  demoPositions,
} from '../src/mocks/family.ts';
import {
  isParent,
  previewPositions,
  initialTreeView,
  revealRelativeInTree,
  visibleTree,
} from '../src/mocks/familyView.ts';

const parentIds = (connections: typeof demoConnections, id: string) =>
  connections
    .filter((link) => isParent(link) && link.target === id)
    .map((link) => link.source)
    .sort();
test('adding a sibling copies both known parents and no unrelated personal facts', () => {
  const result = addRelative(
    demoPeople,
    demoConnections,
    '3',
    'sibling',
    'Adam Malinowski',
  );
  assert.deepEqual(parentIds(result.connections, result.person.id), ['1', '2']);
  assert.equal(result.placeholders, 0);
  assert.equal(result.person.birth, '');
  assert.equal(result.person.birthPlace, '');
  assert.equal(result.person.residence, '');
  assert.equal(result.person.notes, '');
  assert.equal(demoPeople.length, 14);
  assert.equal(
    demoConnections.some((link) => link.target === result.person.id),
    false,
  );
});
test('half sibling uses only the selected common parent', () => {
  const result = addRelative(
    demoPeople,
    demoConnections,
    '3',
    'sibling',
    'Adam Malinowski',
    undefined,
    { parentIds: ['1'] },
  );
  assert.deepEqual(parentIds(result.connections, result.person.id), ['1']);
});
test('unknown parents are shared, editable placeholders and reused for the next sibling', () => {
  const source = { ...demoPeople[2], id: 'root' };
  const first = addRelative([source], [], 'root', 'sibling', 'Adam Testowy');
  assert.equal(first.placeholders, 2);
  assert.equal(first.people.length, 4);
  const parents = first.people.filter((person) => person.isPlaceholder);
  assert.equal(parents.length, 2);
  assert.ok(
    parents.every(
      (person) => !person.birth && !person.lastName && !person.residence,
    ),
  );
  assert.deepEqual(
    parentIds(first.connections, 'root'),
    parentIds(first.connections, first.person.id),
  );
  assert.equal(
    first.connections.some((link) => link.kind === 'partner'),
    false,
    'Do not invent marriage',
  );
  const second = addRelative(
    first.people,
    first.connections,
    'root',
    'sibling',
    'Ewa Testowa',
  );
  assert.equal(second.placeholders, 0);
  assert.equal(
    second.people.filter((person) => person.isPlaceholder).length,
    2,
  );
  assert.deepEqual(
    parentIds(second.connections, second.person.id),
    parentIds(first.connections, 'root'),
  );
  const firstLayout = previewPositions(first.people, first.connections, {});
  const secondLayout = previewPositions(second.people, second.connections, {});
  for (const person of first.people)
    assert.deepEqual(
      secondLayout[person.id],
      firstLayout[person.id],
      'Adding another sibling preserves existing card positions',
    );
  const layout = previewPositions(first.people, first.connections, {});
  assert.equal(layout[first.person.id].y, layout.root.y);
  assert.ok(parents.every((parent) => layout[parent.id].y < layout.root.y));
});
test('one known parent is reused without inventing a second parent', () => {
  const links = demoConnections.filter(
    (link) => link.target === '3' && link.source === '1',
  );
  const result = addRelative(
    demoPeople,
    links,
    '3',
    'sibling',
    'Adam Malinowski',
  );
  assert.equal(result.placeholders, 0);
  assert.deepEqual(parentIds(result.connections, result.person.id), ['1']);
});
test('child defaults to both known partners', () => {
  const result = addRelative(
    demoPeople,
    demoConnections,
    '3',
    'child',
    'Adam Malinowski',
  );
  assert.deepEqual(parentIds(result.connections, result.person.id), ['3', '4']);
});
test('multiple partners require an explicit second parent instead of guessing', () => {
  const links = [
    ...demoConnections,
    { id: 'second-partner', source: '3', target: '5', kind: 'partner' },
  ];
  const result = addRelative(
    demoPeople,
    links,
    '3',
    'child',
    'Adam Malinowski',
  );
  assert.deepEqual(parentIds(result.connections, result.person.id), ['3']);
  const explicit = addRelative(
    demoPeople,
    links,
    '3',
    'child',
    'Adam Malinowski',
    undefined,
    { coParentId: '5' },
  );
  assert.deepEqual(parentIds(explicit.connections, explicit.person.id), [
    '3',
    '5',
  ]);
});
test('adoptive sibling preserves the parent link types', () => {
  const result = addRelative(
    demoPeople,
    demoConnections,
    '9',
    'sibling',
    'Adam Kowalski',
  );
  assert.ok(
    result.connections
      .filter((link) => link.target === result.person.id)
      .every((link) => link.kind === 'adoption'),
  );
});
test('existing persons are reused without duplicate connections', () => {
  const result = addRelative(
    demoPeople,
    demoConnections,
    '3',
    'sibling',
    '',
    '5',
  );
  assert.equal(result.people.length, demoPeople.length);
  assert.equal(result.connections.length, demoConnections.length);
});
test('adding a parent uses the correct direction and rejects ancestry cycles', () => {
  const result = addRelative(
    demoPeople,
    demoConnections,
    '6',
    'parent',
    'Adam Kowalski',
  );
  assert.ok(
    result.connections.some(
      (link) => link.source === result.person.id && link.target === '6',
    ),
  );
  assert.throws(
    () => addRelative(demoPeople, demoConnections, '3', 'parent', '', '7'),
    /cykl/,
  );
});
test('new sibling can be revealed with newly created parents in the existing view', () => {
  const source = { ...demoPeople[2], id: 'root' };
  const state = initialTreeView([source], []);
  const result = addRelative(
    [source],
    [],
    'root',
    'sibling',
    'Adam Malinowski',
  );
  const next = revealRelativeInTree(result.people, result.connections, state, {
    id: result.person.id,
    relativeTo: 'root',
    kind: 'sibling',
    token: '1',
  });
  assert.equal(
    visibleTree(result.people, result.connections, next).visible.size,
    4,
  );
  assert.equal(
    relationContext(source, result.people, result.connections).parents.length,
    2,
  );
});

test('adding a relative saves structured dates, places and an explicitly unknown surname', () => {
  const profile = {
    firstName: ' Maria Anna ',
    lastName: '',
    birth: ' 1904 ',
    death: '1982',
    birthPlace: ' Kraków ',
    residence: 'Łódź',
  };
  const { person } = addRelative(
    demoPeople,
    demoConnections,
    '3',
    'child',
    '',
    undefined,
    {
      profile,
      coParentId: '',
    },
  );
  assert.equal(person.firstName, 'Maria Anna');
  assert.equal(person.lastName, '');
  assert.equal(person.birth, '1904');
  assert.equal(person.death, '1982');
  assert.equal(person.birthPlace, 'Kraków');
  assert.equal(person.residence, 'Łódź');
});

test('adding a first partner to a visible sibling keeps the original anchor and lineage open', () => {
  const state = initialTreeView(demoPeople, demoConnections);
  const connections = demoConnections.filter(
    (link) =>
      !(link.kind === 'partner' && [link.source, link.target].includes('5')),
  );
  const {
    people,
    person,
    connections: updated,
  } = addRelative(demoPeople, connections, '5', 'partner', 'Karol Testowy');
  const next = revealRelativeInTree(people, updated, state, {
    id: person.id,
    relativeTo: '5',
    kind: 'partner',
    token: 'test',
  });
  assert.equal(next.anchorId, state.anchorId);
  assert.deepEqual(next.openParents, state.openParents);
  const { visible } = visibleTree(people, updated, next);
  for (const id of ['1', '2', '3', '5', person.id])
    assert.ok(visible.has(id), id);
});
