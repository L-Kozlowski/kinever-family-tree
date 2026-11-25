import type { Person, DemoConnection } from '../types';

const collator = new Intl.Collator('pl', {
  sensitivity: 'base',
  numeric: true,
});
const surname = (person: Person) =>
  person.maidenName.trim() || person.lastName.trim();
const normalize = (value: string) =>
  value
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
export function directoryPeople(
  people: Person[],
  connections: DemoConnection[],
  query: string,
  isolated: boolean,
): Person[] {
  const ids = new Set(people.map((person) => person.id));
  const connected = new Set<string>();
  for (const link of connections) {
    if (
      link.source !== link.target &&
      ids.has(link.source) &&
      ids.has(link.target)
    ) {
      connected.add(link.source);
      connected.add(link.target);
    }
  }
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return people
    .filter((person) => {
      if (isolated && connected.has(person.id)) return false;
      const text = normalize(
        `${person.firstName} ${person.lastName} ${person.maidenName} ${person.familiarName ?? ''}`,
      );
      return terms.every((term) => text.includes(term));
    })
    .sort(
      (a, b) =>
        collator.compare(surname(a), surname(b)) ||
        collator.compare(a.firstName, b.firstName) ||
        collator.compare(a.id, b.id),
    );
}
