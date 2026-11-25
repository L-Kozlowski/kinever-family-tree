import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPeople } from '../src/mocks/family.ts';
import {
  visibleTree,
  toggleTreeParents,
  toggleTreeChildren,
  focusTreePerson,
  cycleTreePartner,
} from '../src/mocks/familyView.ts';
import {
  restoreBookmarkView,
  saveTreeView,
} from '../src/mocks/treeBookmarks.ts';
import type { DemoConnection } from '../src/types/index.ts';

const person = (id: string) => ({ ...demoPeople[0], id });
const connection = (
  source: string,
  target: string,
  kind = 'parent',
): DemoConnection => ({ id: source + target, source, target, kind });

test('a restored view keeps existing cards, hides later relatives and shows a later partner', () => {
  const people = [
    'root',
    'child',
    'parent',
    'new-parent',
    'new-child',
    'partner',
  ].map(person);
  const links = [
    connection('parent', 'root'),
    connection('new-parent', 'root'),
    connection('root', 'child'),
    connection('root', 'new-child'),
    connection('root', 'partner', 'partner'),
  ];
  const saved = saveTreeView({
    anchorId: 'root',
    openParents: new Set(['root']),
    collapsedFamilies: new Set(),
  });
  const restored = restoreBookmarkView(
    saved,
    ['root', 'child', 'parent'],
    people,
  );
  assert.deepEqual([...visibleTree(people, links, restored).visible].sort(), [
    'child',
    'parent',
    'partner',
    'root',
  ]);
  const parentsOpen = toggleTreeParents(people, links, restored, 'root');
  assert.ok(visibleTree(people, links, parentsOpen).visible.has('new-parent'));
  const childrenOpen = toggleTreeChildren(people, links, restored, 'root');
  assert.ok(visibleTree(people, links, childrenOpen).visible.has('new-child'));
  const focused = focusTreePerson(people, links, restored, 'new-child');
  assert.ok(visibleTree(people, links, focused).visible.has('new-child'));
});

test('a later partner is available in the existing partner selector', () => {
  const people = ['a', 'b', 'c'].map(person);
  const connections = [
    connection('a', 'b', 'partner'),
    connection('a', 'c', 'partner'),
  ];
  const saved = saveTreeView({
    anchorId: 'a',
    openParents: new Set(),
    collapsedFamilies: new Set(),
    selectedPartners: { a: 'b', b: 'a' },
  });
  const restored = restoreBookmarkView(saved, ['a', 'b'], people);
  assert.deepEqual(
    [...visibleTree(people, connections, restored).visible].sort(),
    ['a', 'b'],
  );
  const switched = cycleTreePartner(people, connections, restored, 'a', 1);
  assert.deepEqual(
    [...visibleTree(people, connections, switched).visible].sort(),
    ['a', 'c'],
  );
});

test('restoring a bookmark preserves explicitly collapsed families and an existing hidden person filter', () => {
  const people = ['a', 'b', 'child', 'new-child'].map(person);
  const connections = [
    connection('a', 'b', 'partner'),
    connection('a', 'child'),
    connection('b', 'child'),
    connection('a', 'new-child'),
    connection('b', 'new-child'),
  ];
  const saved = saveTreeView({
    anchorId: 'a',
    openParents: new Set(),
    collapsedFamilies: new Set(['a-b']),
    hiddenPeople: new Set(['new-child']),
  });
  const restored = restoreBookmarkView(
    JSON.parse(JSON.stringify(saved)),
    people.map((p) => p.id),
    people,
  );
  assert.deepEqual(
    [...visibleTree(people, connections, restored).visible].sort(),
    ['a', 'b'],
  );
  assert.deepEqual(
    [...toggleTreeChildren(people, connections, restored, 'a-b').hiddenPeople!],
    [],
  );
});
