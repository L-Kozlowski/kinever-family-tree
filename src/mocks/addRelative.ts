import type {
  Person,
  DemoConnection,
  RelationKind,
  DemoRelationOptions,
} from '../types';
import { isParent, familyName } from './familyView.ts';

export function relationContext(
  person: Person,
  people: Person[],
  connections: DemoConnection[],
) {
  const ids = new Set(people.map((person) => person.id));
  const parents = connections.filter(
    (link) =>
      isParent(link) && link.target === person.id && ids.has(link.source),
  );
  const partnerIds = [
    ...new Set(
      connections
        .filter(
          (link) =>
            link.kind === 'partner' &&
            (link.source === person.id || link.target === person.id),
        )
        .map((link) => (link.source === person.id ? link.target : link.source)),
    ),
  ];
  return {
    parents,
    partners: people.filter((person) => partnerIds.includes(person.id)),
    surname: familyName(person),
  };
}

/** Session-only editing adapter. Unknown facts remain empty, not copied from fixtures. */
export function addRelative(
  people: Person[],
  connections: DemoConnection[],
  sourceId: string,
  kind: RelationKind,
  name: string,
  existingId?: string,
  options: DemoRelationOptions = {},
) {
  const source = people.find((person) => person.id === sourceId);
  if (!source) throw new Error('Nie znaleziono osoby w tym drzewie.');
  if (existingId === sourceId) throw new Error('Wybierz inną osobę.');
  const nextPeople = [...people];
  const nextConnections = [...connections];
  const createPerson = (
    firstName: string,
    lastName: string,
    gender = '',
    isPlaceholder = false,
  ): Person => ({
    id: crypto.randomUUID(),
    firstName,
    lastName,
    maidenName: '',
    birth: '',
    death: '',
    birthPlace: '',
    residence: '',
    notes: '',
    portrait: gender === 'Kobieta' ? 3 : 2,
    gender,
    isPlaceholder,
  });
  let target = existingId
    ? people.find((person) => person.id === existingId)
    : undefined;
  if (existingId && !target)
    throw new Error('Wybrana osoba nie należy do tego drzewa.');
  if (!target) {
    const parts = name.trim().split(/\s+/);
    if (!(options.profile?.firstName ?? name).trim())
      throw new Error('Podaj imię osoby.');
    target = createPerson(
      options.profile?.firstName.trim() ?? parts[0],
      options.profile?.lastName.trim() ??
        (parts.slice(1).join(' ') || familyName(source)),
      options.gender,
    );
    if (options.profile) {
      const { birth, death, birthPlace, residence } = options.profile;
      Object.assign(target, {
        birth: birth.trim(),
        death: death.trim(),
        birthPlace: birthPlace.trim(),
        residence: residence.trim(),
      });
    }
    const familiarName = options.familiarName?.trim();
    if (familiarName) target.familiarName = familiarName;
    nextPeople.push(target);
  }
  const link = (parent: string, child: string, type: string) => {
    if (parent === child)
      throw new Error('Osoba nie może być połączona sama ze sobą.');
    if (
      nextConnections.some(
        (edge) =>
          edge.source === parent && edge.target === child && edge.kind === type,
      )
    )
      return;
    if (
      type === 'partner' &&
      nextConnections.some(
        (edge) =>
          edge.kind === 'partner' &&
          edge.source === child &&
          edge.target === parent,
      )
    )
      return;
    if (type !== 'partner') {
      const visited = new Set([child]);
      const queue = [child];
      while (queue.length) {
        const current = queue.shift();
        for (const edge of nextConnections.filter(
          (edge) => isParent(edge) && edge.source === current,
        )) {
          if (!visited.has(edge.target)) {
            visited.add(edge.target);
            queue.push(edge.target);
          }
        }
      }
      if (visited.has(parent))
        throw new Error('Takie połączenie utworzyłoby cykl rodzic–dziecko.');
    }
    nextConnections.push({
      id: crypto.randomUUID(),
      source: parent,
      target: child,
      kind: type,
    });
  };
  const context = relationContext(source, people, connections);
  let placeholders = 0;
  if (kind === 'partner') link(sourceId, target.id, 'partner');
  else if (kind === 'parent')
    link(target.id, sourceId, options.adopted ? 'adoption' : 'parent');
  else if (kind === 'child') {
    link(sourceId, target.id, options.adopted ? 'adoption' : 'parent');
    const coParent =
      options.coParentId ??
      (context.partners.length === 1 ? context.partners[0].id : '');
    if (coParent) {
      if (!people.some((person) => person.id === coParent))
        throw new Error('Nie znaleziono drugiego rodzica.');
      link(coParent, target.id, options.adopted ? 'adoption' : 'parent');
    }
  } else {
    let parents = context.parents;
    if (parents.length) {
      const selected =
        options.parentIds ?? parents.map((parent) => parent.source);
      parents = parents.filter((parent) => selected.includes(parent.source));
      if (!parents.length)
        throw new Error('Wybierz co najmniej jednego wspólnego rodzica.');
    } else {
      for (const [firstName, gender] of [
        ['Nieznany ojciec', 'Mężczyzna'],
        ['Nieznana matka', 'Kobieta'],
      ]) {
        const parent = createPerson(firstName, '', gender, true);
        nextPeople.push(parent);
        placeholders++;
        link(parent.id, sourceId, 'parent');
      }
      parents = nextConnections.filter(
        (edge) => isParent(edge) && edge.target === sourceId,
      );
    }
    for (const parent of parents) link(parent.source, target.id, parent.kind);
  }
  return {
    people: nextPeople,
    connections: nextConnections,
    person: target,
    placeholders,
  };
}
