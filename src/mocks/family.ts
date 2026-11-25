import type { FamilyTree, Person, DemoConnection } from '../types';

const person = (
  id: string,
  firstName: string,
  lastName: string,
  birth: string,
  death: string,
  portrait: number,
  birthPlace = 'Kraków',
): Person => ({
  id,
  firstName,
  lastName,
  birth,
  death,
  portrait,
  birthPlace,
  residence: 'Kraków, Polska',
  maidenName: '',
  notes:
    'W rodzinnym domu zawsze było miejsce przy stole dla jeszcze jednej osoby. Lubił(a) długie spacery i opowieści przy herbacie.\n\nTo fikcyjna historia przygotowana na potrzeby prototypu.',
});
export const demoPeople: Person[] = [
  person('1', 'Stanisław', 'Malinowski', '1928', '2004', 0),
  {
    ...person('2', 'Helena', 'Malinowska', '1932', '2016', 1, 'Wieliczka'),
    maidenName: 'Zielińska',
  },
  person('3', 'Jan', 'Malinowski', '1956', '', 2),
  {
    ...person('4', 'Maria', 'Malinowska', '1959', '', 3, 'Zakopane'),
    maidenName: 'Nowak',
  },
  {
    ...person('5', 'Zofia', 'Kowalska', '1961', '', 1),
    maidenName: 'Malinowska',
  },
  person('6', 'Piotr', 'Kowalski', '1958', '', 0, 'Tarnów'),
  person('7', 'Anna', 'Malinowska', '1985', '', 3),
  person('8', 'Michał', 'Malinowski', '1988', '', 2),
  person('9', 'Julia', 'Kowalska', '1990', '', 1),
  person('10', 'Antoni', 'Malinowski', '1901', '1978', 0, 'Bochnia'),
  person('11', 'Jadwiga', 'Malinowska', '1905', '1982', 1),
  person('12', 'Franciszek', 'Malinowski', '2014', '', 2),
  person('13', 'Józef', 'Nowak', '1930', '2008', 0, 'Zakopane'),
  {
    ...person('14', 'Teresa', 'Nowak', '1935', '2019', 1, 'Zakopane'),
    maidenName: 'Wójcik',
  },
];
export const demoTrees: FamilyTree[] = [
  {
    id: 'malinowscy',
    name: 'Rodzina Malinowskich',
    description: 'Od małego domu pod Krakowem do naszych wspólnych historii.',
    people: demoPeople,
    updated: 'Przed chwilą',
  },
  {
    id: 'nowakowie',
    name: 'Rodzina Nowaków',
    description: 'Wspomnienia z gór, stare fotografie i bliskie nam miejsca.',
    people: demoPeople
      .slice(3, 9)
      .map((p) => ({ ...p, lastName: p.portrait % 2 ? 'Nowak' : 'Nowak' })),
    updated: 'Wczoraj',
  },
];
export const demoConnections: DemoConnection[] = [
  { id: 'a', source: '1', target: '2', kind: 'partner' },
  { id: 'b', source: '1', target: '3', kind: 'parent' },
  { id: 'c', source: '2', target: '5', kind: 'parent' },
  { id: 'd', source: '3', target: '4', kind: 'partner' },
  { id: 'e', source: '5', target: '6', kind: 'partner' },
  { id: 'f', source: '3', target: '7', kind: 'parent' },
  { id: 'g', source: '4', target: '8', kind: 'parent' },
  { id: 'h', source: '5', target: '9', kind: 'adoption' },
  { id: 'i', source: '10', target: '11', kind: 'partner' },
  { id: 'j', source: '10', target: '1', kind: 'parent' },
  { id: 'k', source: '8', target: '12', kind: 'parent' },
  { id: 'b2', source: '2', target: '3', kind: 'parent' },
  { id: 'c2', source: '1', target: '5', kind: 'parent' },
  { id: 'f2', source: '4', target: '7', kind: 'parent' },
  { id: 'g2', source: '3', target: '8', kind: 'parent' },
  { id: 'h2', source: '6', target: '9', kind: 'adoption' },
  { id: 'j2', source: '11', target: '1', kind: 'parent' },
  { id: 'maria-parents', source: '13', target: '14', kind: 'partner' },
  { id: 'maria-father', source: '13', target: '4', kind: 'parent' },
  { id: 'maria-mother', source: '14', target: '4', kind: 'parent' },
];
export const demoPositions: Record<string, { x: number; y: number }> = {
  '1': { x: 235, y: 40 },
  '2': { x: 475, y: 40 },
  '3': { x: 75, y: 305 },
  '4': { x: 310, y: 305 },
  '5': { x: 625, y: 305 },
  '6': { x: 860, y: 305 },
  '7': { x: 30, y: 570 },
  '8': { x: 310, y: 570 },
  '9': { x: 745, y: 570 },
  '10': { x: 105, y: -225 },
  '11': { x: 345, y: -225 },
  '12': { x: 310, y: 835 },
  '13': { x: 235, y: 40 },
  '14': { x: 475, y: 40 },
};
