import type { Person, SurnameFamily } from '../types';
export type SurnameGroup = SurnameFamily & {
  people: Person[];
  manual: boolean;
};
const key = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl');
const compare = new Intl.Collator('pl', { sensitivity: 'base', numeric: true })
  .compare;
export function surnameForms(value: string) {
  const name = value.trim().replace(/\s+/g, ' ');
  // Only regular adjective endings are inferred; other pairs are explicit.
  const masculine = name.replace(
    /(s|c|dz)ka$/i,
    (ending) =>
      ending.slice(0, -1) + (ending === ending.toUpperCase() ? 'I' : 'i'),
  );
  const feminine = masculine.replace(
    /(s|c|dz)ki$/i,
    (ending) =>
      ending.slice(0, -1) + (ending === ending.toUpperCase() ? 'A' : 'a'),
  );
  return { masculine, feminine };
}
const unique = (values: string[]) => [
  ...new Map(
    values
      .filter((v) => v.trim())
      .map((v) => [key(v), v.trim().replace(/\s+/g, ' ')]),
  ).values(),
];
export function surnameGroups(
  people: Person[],
  definitions: SurnameFamily[] = [],
): SurnameGroup[] {
  const groups: SurnameGroup[] = definitions.map((d) => ({
    ...d,
    aliases: unique([...d.aliases, d.masculine, d.feminine]),
    people: [],
    manual: true,
  }));
  const aliases = new Map(
    groups.flatMap((g) => g.aliases.map((a) => [key(a), g] as const)),
  );
  const automatic = new Map<string, SurnameGroup>();
  for (const person of people) {
    if (person.isPlaceholder) continue;
    const split = (name: string) =>
      name
        .split(/[-‐‑]/)
        .map((part) => part.trim())
        .filter(Boolean);
    const birthNames = split(person.maidenName);
    const currentNames = split(person.lastName);
    const names =
      birthNames.length > 1
        ? birthNames
        : currentNames.length > 1
          ? currentNames
          : birthNames.length
            ? birthNames
            : currentNames;
    const memberships = new Set<SurnameGroup>();
    for (const name of names) {
      const forms = surnameForms(name);
      let group =
        aliases.get(key(name)) ||
        aliases.get(key(forms.masculine)) ||
        aliases.get(key(forms.feminine));
      if (!group) {
        const id = 'surname:' + key(forms.masculine);
        group = automatic.get(id);
        if (!group) {
          group = { id, ...forms, aliases: [], people: [], manual: false };
          automatic.set(id, group);
          groups.push(group);
        }
      }
      group.aliases = unique([
        ...group.aliases,
        name,
        forms.masculine,
        forms.feminine,
      ]);
      if (!memberships.has(group)) {
        group.people.push(person);
        memberships.add(group);
      }
    }
  }
  for (const group of groups)
    group.people.sort(
      (a, b) => compare(a.firstName, b.firstName) || compare(a.id, b.id),
    );
  return groups.sort((a, b) => compare(a.masculine, b.masculine));
}
export function surnameSuggestions(
  people: Person[],
  definitions: SurnameFamily[] = [],
): string[] {
  return unique([
    ...people.flatMap((p) =>
      p.isPlaceholder ? [] : [p.lastName, p.maidenName],
    ),
    ...surnameGroups(people, definitions).flatMap((g) => [
      g.masculine,
      g.feminine,
      ...g.aliases,
    ]),
  ]).sort(compare);
}
export function setSurnameForms(
  people: Person[],
  definitions: SurnameFamily[],
  groupId: string,
  masculine: string,
  feminine: string,
): SurnameFamily[] {
  masculine = masculine.trim().replace(/\s+/g, ' ');
  feminine = feminine.trim().replace(/\s+/g, ' ');
  if (
    !masculine ||
    !feminine ||
    masculine.length > 500 ||
    feminine.length > 500
  )
    throw new Error('Uzupełnij obie odmiany nazwiska (do 500 znaków).');
  const groups = surnameGroups(people, definitions);
  const target = groups.find((g) => g.id === groupId);
  if (!target) throw new Error('Nie znaleziono rodziny. Odśwież widok.');
  const merged = new Set([target.id]);
  let aliases = unique([
    ...target.aliases,
    target.masculine,
    target.feminine,
    masculine,
    feminine,
  ]);
  let changed = true;
  while (changed) {
    changed = false;
    const names = new Set(aliases.map(key));
    for (const group of groups)
      if (
        !merged.has(group.id) &&
        [group.masculine, group.feminine, ...group.aliases].some((a) =>
          names.has(key(a)),
        )
      ) {
        merged.add(group.id);
        aliases = unique([
          ...aliases,
          group.masculine,
          group.feminine,
          ...group.aliases,
        ]);
        changed = true;
      }
  }
  return [
    ...definitions.filter((d) => !merged.has(d.id)),
    { id: target.id, masculine, feminine, aliases },
  ];
}
