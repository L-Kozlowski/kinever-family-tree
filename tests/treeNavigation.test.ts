import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPeople, demoConnections } from '../src/mocks/family.ts';
import {
  initialTreeView,
  visibleTree,
  toggleTreeChildren,
  toggleTreeParents,
} from '../src/mocks/familyView.ts';

const initial = () => initialTreeView(demoPeople, demoConnections);
const visible = (state: ReturnType<typeof initial>) =>
  visibleTree(demoPeople, demoConnections, state).visible;
test('one family control hides all children and descendants but leaves the other family open', () => {
  const state = toggleTreeChildren(
    demoPeople,
    demoConnections,
    initial(),
    '3-4',
  );
  for (const id of ['7', '8', '12'])
    assert.equal(visible(state).has(id), false, id);
  for (const id of ['1', '2', '3', '4', '5', '6', '9'])
    assert.equal(visible(state).has(id), true, id);
});
test('collapsing the upper family also hides the focused child and both child families', () => {
  const state = toggleTreeChildren(
    demoPeople,
    demoConnections,
    initial(),
    '1-2',
  );
  assert.deepEqual([...visible(state)].sort(), ['1', '2']);
});
test('nested family collapses survive closing and reopening the upper family', () => {
  let state = toggleTreeChildren(demoPeople, demoConnections, initial(), '3-4');
  state = toggleTreeChildren(demoPeople, demoConnections, state, '1-2');
  state = toggleTreeChildren(demoPeople, demoConnections, state, '1-2');
  assert.equal(visible(state).has('3'), true);
  assert.equal(visible(state).has('5'), true);
  assert.equal(visible(state).has('7'), false);
  assert.equal(visible(state).has('8'), false);
});
test('hiding parents removes all ancestors while preserving the selected couple and children', () => {
  let state = toggleTreeParents(demoPeople, demoConnections, initial(), '1');
  assert.equal(visible(state).has('10'), true);
  state = toggleTreeParents(demoPeople, demoConnections, state, '3');
  for (const id of ['1', '2', '10', '11'])
    assert.equal(visible(state).has(id), false, id);
  for (const id of ['3', '4', '7', '8'])
    assert.equal(visible(state).has(id), true, id);
});
test('both parental sides can stay open and collapse independently', () => {
  let state = toggleTreeParents(demoPeople, demoConnections, initial(), '1');
  state = toggleTreeParents(demoPeople, demoConnections, state, '4');
  for (const id of ['1', '2', '10', '11', '13', '14', '3', '4'])
    assert.equal(visible(state).has(id), true, id);
  state = toggleTreeParents(demoPeople, demoConnections, state, '3');
  assert.equal(visible(state).has('1'), false);
  assert.equal(visible(state).has('13'), true);
  assert.equal(visible(state).has('14'), true);
});
test('a child can hide its own parents even when they were the original anchor', () => {
  const state = toggleTreeParents(demoPeople, demoConnections, initial(), '8');
  assert.deepEqual([...visible(state)], ['8', '12']);
});
test('no parents in the fixture means no change to the view', () => {
  const state = initial();
  assert.equal(
    toggleTreeParents(demoPeople, demoConnections, state, '2'),
    state,
  );
});
