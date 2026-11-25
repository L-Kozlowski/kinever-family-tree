import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoConnections,
  demoPeople,
  demoPositions,
} from '../src/mocks/family.ts';
import {
  familyName,
  relativesOf,
  previewPositions,
} from '../src/mocks/familyView.ts';

test('family profile distinguishes parents, partner, siblings and children', () => {
  const sections = relativesOf(demoPeople[2], demoPeople, demoConnections);
  assert.deepEqual(
    sections.map((section) => section.people.map((person) => person.id)),
    [['1', '2'], ['4'], ['5'], ['7', '8']],
  );
});
test('birth surname is preferred, with current surname as fallback', () => {
  assert.equal(familyName(demoPeople[1]), 'Zielińska');
  assert.equal(familyName(demoPeople[3]), 'Nowak');
  assert.equal(familyName(demoPeople[2]), 'Malinowski');
});
test('siblings in the fixture share a generation', () => {
  assert.equal(demoPositions['3'].y, demoPositions['5'].y);
  assert.equal(demoPositions['7'].y, demoPositions['8'].y);
});
test('a newly added sibling is placed on the same generation as existing children', () => {
  const sibling = { ...demoPeople[2], id: 'new-sibling', firstName: 'Adam' };
  const positions = previewPositions(
    [...demoPeople, sibling],
    [
      ...demoConnections,
      { id: 'new', source: '1', target: sibling.id, kind: 'parent' },
    ],
    demoPositions,
  );
  assert.equal(positions[sibling.id].y, positions['3'].y);
  assert.notEqual(positions[sibling.id].x, positions['3'].x);
});
