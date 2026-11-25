import type { DemoConnection, Person, RevealRelative } from '../types';

export const familyName = (person: Person) =>
  person.maidenName.trim() || person.lastName;
export const fullName = (person: Person) =>
  `${person.firstName} ${familyName(person)}`.trim();
export function comparePartnerSides(a?: Person, b?: Person) {
  if (a?.gender === 'Mężczyzna' && b?.gender === 'Kobieta') return -1;
  if (a?.gender === 'Kobieta' && b?.gender === 'Mężczyzna') return 1;
  return 0;
}
export const isParent = (connection: DemoConnection) =>
  connection.kind === 'parent' || connection.kind === 'adoption';

export function hiddenDescendantCount(
  children: string[],
  connections: DemoConnection[],
  visible: Set<string>,
) {
  const descendants = new Set(children);
  const childrenByParent = new Map<string, string[]>();
  for (const link of connections) {
    if (!isParent(link)) continue;
    const children = childrenByParent.get(link.source) ?? [];
    children.push(link.target);
    childrenByParent.set(link.source, children);
  }
  for (const id of descendants)
    for (const child of childrenByParent.get(id) ?? []) descendants.add(child);
  return [...descendants].filter((id) => !visible.has(id)).length;
}

export function previewPositions(
  people: Person[],
  connections: DemoConnection[],
  initial: Record<string, { x: number; y: number }>,
) {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const person of people)
    if (initial[person.id]) positions[person.id] = initial[person.id];
  const pending = people.filter((person) => !positions[person.id]);
  if (people.length && !Object.keys(positions).length)
    positions[people[0].id] = { x: 0, y: 40 };
  const place = (id: string, desired: { x: number; y: number }) => {
    let x = desired.x;
    while (
      Object.values(positions).some(
        (position) =>
          Math.abs(position.y - desired.y) < 100 &&
          Math.abs(position.x - x) < 215,
      )
    )
      x += 240;
    positions[id] = { x, y: desired.y };
  };
  for (let pass = 0; pass < people.length; pass++) {
    const hasKnownChild = (id: string) =>
      connections.some(
        (link) =>
          isParent(link) && link.source === id && !!positions[link.target],
      );
    const remaining = pending
      .filter((person) => !positions[person.id])
      .sort(
        (left, right) =>
          Number(hasKnownChild(right.id)) - Number(hasKnownChild(left.id)),
      );
    for (const person of remaining) {
      const spouse = connections.find(
        (link) =>
          link.kind === 'partner' &&
          ((link.source === person.id && positions[link.target]) ||
            (link.target === person.id && positions[link.source])),
      );
      const parent = connections.find(
        (link) =>
          isParent(link) && link.target === person.id && positions[link.source],
      );
      const child = connections.find(
        (link) =>
          isParent(link) && link.source === person.id && positions[link.target],
      );
      if (spouse) {
        const anchor =
          positions[
            spouse.source === person.id ? spouse.target : spouse.source
          ];
        place(person.id, { x: anchor.x + 240, y: anchor.y });
      } else if (parent) {
        const anchor = positions[parent.source];
        place(person.id, { x: anchor.x, y: anchor.y + 265 });
      } else if (child) {
        const anchor = positions[child.target];
        place(person.id, { x: anchor.x, y: anchor.y - 265 });
      }
    }
  }
  pending
    .filter((person) => !positions[person.id])
    .forEach((person, index) => place(person.id, { x: index * 240, y: 40 }));
  return positions;
}

/** Presentation-only graph derived from the in-memory fixture, without persistence. */
export function familyBranches(
  people: Person[],
  connections: DemoConnection[],
) {
  const ids = new Set(people.map((person) => person.id));
  return people.flatMap((child) => {
    const links = connections.filter(
      (link) =>
        isParent(link) && link.target === child.id && ids.has(link.source),
    );
    const parents = [...new Set(links.map((link) => link.source))].sort();
    return parents.length
      ? [
          {
            id: `${parents.join('-')}>${child.id}`,
            child: child.id,
            parents,
            adopted: links.some((link) => link.kind === 'adoption'),
          },
        ]
      : [];
  });
}

export function relativesOf(
  person: Person,
  people: Person[],
  connections: DemoConnection[],
) {
  const parents = new Set(
    connections
      .filter((link) => isParent(link) && link.target === person.id)
      .map((link) => link.source),
  );
  const children = new Set(
    connections
      .filter((link) => isParent(link) && link.source === person.id)
      .map((link) => link.target),
  );
  const partners = new Set(
    connections
      .filter(
        (link) =>
          link.kind === 'partner' &&
          (link.source === person.id || link.target === person.id),
      )
      .map((link) => (link.source === person.id ? link.target : link.source)),
  );
  const siblings = new Set(
    connections
      .filter(
        (link) =>
          isParent(link) &&
          parents.has(link.source) &&
          link.target !== person.id,
      )
      .map((link) => link.target),
  );
  return (
    [
      { kind: 'parent', title: 'Rodzice', ids: parents },
      { kind: 'partner', title: 'Małżonkowie / partnerzy', ids: partners },
      { kind: 'sibling', title: 'Rodzeństwo', ids: siblings },
      { kind: 'child', title: 'Dzieci', ids: children },
    ] as const
  ).map((section) => ({
    kind: section.kind,
    title: section.title,
    people: people.filter((relative) => section.ids.has(relative.id)),
  }));
}

export function familyGroups(people: Person[], connections: DemoConnection[]) {
  const groups = new Map<
    string,
    {
      id: string;
      parents: string[];
      children: { id: string; adopted: boolean }[];
    }
  >();
  for (const branch of familyBranches(people, connections)) {
    const id = branch.parents.join('-');
    if (!groups.has(id))
      groups.set(id, { id, parents: branch.parents, children: [] });
    groups
      .get(id)!
      .children.push({ id: branch.child, adopted: branch.adopted });
  }
  return [...groups.values()];
}
export type TreeViewState = {
  anchorId: string;
  openParents: Set<string>;
  collapsedFamilies: Set<string>;
  selectedPartners?: Record<string, string>;
  hiddenPeople?: Set<string>;
};

export function revealPeople(
  state: TreeViewState,
  ids: string[],
): TreeViewState {
  if (!state.hiddenPeople || !ids.some((id) => state.hiddenPeople?.has(id)))
    return state;
  const hiddenPeople = new Set(state.hiddenPeople);
  for (const id of ids) hiddenPeople.delete(id);
  return { ...state, hiddenPeople };
}

export function partnerChoices(
  people: Person[],
  connections: DemoConnection[],
  id: string,
) {
  const valid = new Set(people.map((person) => person.id));
  return [
    ...new Set(
      partnersOf(id, connections).filter((partner) => valid.has(partner)),
    ),
  ];
}

/** Resolve reciprocal pairs so traversing a partner never reveals all their partners. */
export function activePartners(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
) {
  const selected: Record<string, string> = {};
  const assign = (id: string, partner: string) => {
    selected[id] = partner;
    selected[partner] = id;
  };
  for (const [id, partner] of Object.entries(state.selectedPartners || {}))
    if (
      !selected[id] &&
      !selected[partner] &&
      partnerChoices(people, connections, id).includes(partner)
    )
      assign(id, partner);
  for (const id of [state.anchorId, ...people.map((person) => person.id)]) {
    if (selected[id]) continue;
    const partner = partnerChoices(people, connections, id).find(
      (candidate) => !selected[candidate],
    );
    if (partner) assign(id, partner);
  }
  return selected;
}

function selectPartner(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
  id: string,
  partner: string,
): TreeViewState {
  if (!partnerChoices(people, connections, id).includes(partner)) return state;
  const selectedPartners = { ...state.selectedPartners };
  const previous = activePartners(people, connections, state)[id];
  for (const [owner, chosen] of Object.entries(selectedPartners))
    if ([id, partner].includes(owner) || [id, partner].includes(chosen))
      delete selectedPartners[owner];
  selectedPartners[id] = partner;
  selectedPartners[partner] = id;
  const openParents = new Set(state.openParents);
  if (previous && previous !== partner) {
    const ancestors = ancestorsOf(previous, connections);
    openParents.delete(previous);
    for (const expanded of [...openParents])
      if (
        ancestors.has(expanded) ||
        connections.some(
          (link) =>
            isParent(link) &&
            link.target === expanded &&
            ancestors.has(link.source),
        )
      )
        openParents.delete(expanded);
  }
  return { ...state, selectedPartners, openParents };
}

export function cycleTreePartner(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
  id: string,
  direction: number,
): TreeViewState {
  const choices = partnerChoices(people, connections, id);
  if (choices.length < 2) return state;
  const index = choices.indexOf(activePartners(people, connections, state)[id]);
  const partner =
    choices[(Math.max(0, index) + direction + choices.length) % choices.length];
  return {
    ...selectPartner(people, connections, state, id, partner),
    anchorId: id,
  };
}

export function focusTreePerson(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
  id: string,
): TreeViewState {
  const ids = new Set(people.map((person) => person.id));
  const visible = visibleTree(people, connections, state).visible;
  if (!ids.has(id) || visible.has(id)) return state;
  // Find the shortest connection from the currently visible graph. Preserve
  // all unrelated expansion state rather than rebuilding the view around a card.
  const previous = new Map<string, string | null>(
    [...visible].map((key) => [key, null]),
  );
  const queue = [...visible];
  const links = connections.filter(
    (link) => ids.has(link.source) && ids.has(link.target),
  );
  for (let index = 0; index < queue.length && !previous.has(id); index++) {
    const current = queue[index];
    for (const link of links) {
      const other =
        link.source === current
          ? link.target
          : link.target === current
            ? link.source
            : null;
      if (other && !previous.has(other)) {
        previous.set(other, current);
        queue.push(other);
      }
    }
  }
  if (!previous.has(id)) return { ...revealPeople(state, [id]), anchorId: id };
  const path: string[] = [];
  for (
    let current: string | null = id;
    current !== null;
    current = previous.get(current) ?? null
  )
    path.unshift(current);
  let next = revealPeople(state, path);
  const groups = familyGroups(people, connections);
  for (let index = 1; index < path.length; index++) {
    if (visibleTree(people, connections, next).visible.has(id)) break;
    const from = path[index - 1],
      to = path[index];
    const parentLink = links.find(
      (link) =>
        isParent(link) &&
        ((link.source === from && link.target === to) ||
          (link.source === to && link.target === from)),
    );
    if (parentLink) {
      if (parentLink.target === from)
        next = { ...next, openParents: new Set([...next.openParents, from]) };
      else {
        const group = groups.find(
          (group) =>
            group.parents.includes(from) &&
            group.children.some((child) => child.id === to),
        );
        if (group) {
          if (
            group.parents.length === 2 &&
            partnerChoices(people, connections, group.parents[0]).includes(
              group.parents[1],
            ) &&
            activePartners(people, connections, next)[group.parents[0]] !==
              group.parents[1]
          )
            next = selectPartner(
              people,
              connections,
              next,
              group.parents[0],
              group.parents[1],
            );
          const collapsedFamilies = new Set(next.collapsedFamilies);
          collapsedFamilies.delete(group.id);
          next = { ...next, collapsedFamilies };
        }
      }
    } else if (activePartners(people, connections, next)[from] !== to)
      next = selectPartner(people, connections, next, from, to);
  }
  return visibleTree(people, connections, next).visible.has(id)
    ? next
    : { ...next, anchorId: id };
}

/** Pack visible couples as indivisible blocks, with more space between households. */
export function adjacentPartnerPositions(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
  visible: Set<string>,
  base: Record<string, { x: number; y: number }>,
) {
  const positions = Object.fromEntries(
    Object.entries(base).map(([id, point]) => [id, { ...point }]),
  );
  const selected = activePartners(people, connections, state);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const used = new Set<string>();
  const blocks: { ids: string[]; x: number; y: number }[] = [];
  for (const id of [state.anchorId, ...people.map((person) => person.id)]) {
    if (used.has(id) || !visible.has(id) || !positions[id]) continue;
    const partner = selected[id];
    const pair =
      partner &&
      visible.has(partner) &&
      positions[partner] &&
      !used.has(partner);
    const ids = pair
      ? [id, partner].sort(
          (a, b) =>
            comparePartnerSides(peopleById.get(a), peopleById.get(b)) ||
            positions[a].x - positions[b].x ||
            a.localeCompare(b),
        )
      : [id];
    ids.forEach((member) => used.add(member));
    blocks.push({
      ids,
      x: Math.min(...ids.map((member) => positions[member].x)),
      y: positions[id].y,
    });
  }
  const rows = new Map<number, typeof blocks>();
  for (const block of blocks) {
    const row = rows.get(block.y) || [];
    row.push(block);
    rows.set(block.y, row);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x || a.ids[0].localeCompare(b.ids[0]));
    let right = -Infinity;
    for (const block of row) {
      const left = Math.max(block.x, right + 120);
      block.ids.forEach((id, index) => {
        positions[id] = { x: left + index * 240, y: block.y };
      });
      right = left + (block.ids.length - 1) * 240 + 180;
    }
  }
  return positions;
}

export function partnerViewPositions(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
  visible: Set<string>,
  base: Record<string, { x: number; y: number }>,
) {
  let positions = Object.fromEntries(
    Object.entries(base).map(([id, point]) => [id, { ...point }]),
  );
  const selected = activePartners(people, connections, state);
  const groups = familyGroups(people, connections);
  // Select the stable partner slot before packing, including ordinary one-partner couples.
  const slotted = new Set<string>();
  for (const owner of [state.anchorId, ...people.map((person) => person.id)]) {
    const partner = selected[owner];
    if (
      !partner ||
      slotted.has(owner) ||
      slotted.has(partner) ||
      !visible.has(owner) ||
      !visible.has(partner)
    )
      continue;
    const slot = partnerChoices(people, connections, owner)[0];
    if (slot !== partner && !visible.has(slot) && base[slot])
      positions[partner] = { ...base[slot] };
    slotted.add(owner);
    slotted.add(partner);
  }
  positions = adjacentPartnerPositions(
    people,
    connections,
    state,
    visible,
    positions,
  );
  const handled = new Set<string>();
  for (const owner of [state.anchorId, ...people.map((person) => person.id)]) {
    const choices = partnerChoices(people, connections, owner);
    const partner = selected[owner];
    if (
      choices.length < 2 ||
      !partner ||
      !visible.has(owner) ||
      !visible.has(partner) ||
      handled.has(owner) ||
      handled.has(partner)
    )
      continue;
    handled.add(owner);
    handled.add(partner);
    if (!positions[owner] || !positions[partner]) continue;
    const shared = groups
      .filter(
        (group) =>
          group.parents.length === 2 &&
          group.parents.includes(owner) &&
          group.parents.includes(partner),
      )
      .flatMap((group) => group.children.map((child) => child.id))
      .filter((id) => visible.has(id));
    const centre = (positions[owner].x + positions[partner].x) / 2;
    const row = Math.max(positions[owner].y, positions[partner].y) + 325;
    const targets = new Map(
      shared.map((id, index) => [
        id,
        { x: centre + (index - (shared.length - 1) / 2) * 240, y: row },
      ]),
    );
    const bounds = [
      positions[owner].x + 90,
      positions[partner].x + 90,
      ...[...targets.values()].map((point) => point.x + 90),
    ];
    for (const parent of [owner, partner]) {
      const solo = groups
        .filter(
          (group) => group.parents.length === 1 && group.parents[0] === parent,
        )
        .flatMap((group) => group.children.map((child) => child.id))
        .filter((id) => visible.has(id));
      const left =
        positions[parent].x <= positions[parent === owner ? partner : owner].x;
      solo.forEach((id, index) =>
        targets.set(id, {
          x:
            (left
              ? Math.min(...bounds) - 240 * (index + 1)
              : Math.max(...bounds) + 240 * (index + 1)) - 90,
          y: row,
        }),
      );
    }
    const moved = new Set<string>();
    const shift = (id: string, dx: number, dy: number) => {
      if (
        moved.has(id) ||
        !visible.has(id) ||
        !positions[id] ||
        id === owner ||
        id === partner
      )
        return;
      moved.add(id);
      positions[id] = { x: positions[id].x + dx, y: positions[id].y + dy };
      if (selected[id]) shift(selected[id], dx, dy);
      for (const group of groups)
        if (group.parents.includes(id))
          for (const child of group.children) shift(child.id, dx, dy);
    };
    targets.forEach((point, id) => {
      if (positions[id])
        shift(id, point.x - positions[id].x, point.y - positions[id].y);
    });
  }
  return adjacentPartnerPositions(
    people,
    connections,
    state,
    visible,
    positions,
  );
}

function partnersOf(id: string, connections: DemoConnection[]) {
  return connections
    .filter(
      (link) =>
        link.kind === 'partner' && (link.source === id || link.target === id),
    )
    .map((link) => (link.source === id ? link.target : link.source));
}
function ancestorsOf(id: string, connections: DemoConnection[]) {
  const result = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const current = queue.shift();
    for (const link of connections.filter(
      (link) => isParent(link) && link.target === current,
    )) {
      if (!result.has(link.source)) {
        result.add(link.source);
        queue.push(link.source);
      }
    }
  }
  return result;
}

export function initialTreeView(
  people: Person[],
  connections: DemoConnection[],
): TreeViewState {
  const anchorId = people.some((person) => person.id === '3')
    ? '3'
    : people[0]?.id || '';
  return {
    anchorId,
    openParents: new Set([anchorId]),
    collapsedFamilies: new Set(['8']),
    selectedPartners: {},
  };
}
export function visibleTree(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
) {
  const ids = new Set(people.map((person) => person.id));
  const groups = familyGroups(people, connections);
  const selected = activePartners(people, connections, state);
  const allowedGroups = groups.filter((group) =>
    group.parents.every((id) => {
      const relatedPartner = group.parents.find(
        (other) =>
          other !== id &&
          partnerChoices(people, connections, id).includes(other),
      );
      return !relatedPartner || selected[id] === relatedPartner;
    }),
  );
  const visible = new Set(
    ids.has(state.anchorId)
      ? [state.anchorId]
      : people[0]
        ? [people[0].id]
        : [],
  );
  let changed = true;
  while (changed) {
    changed = false;
    const add = (id: string) => {
      if (ids.has(id) && !visible.has(id)) {
        visible.add(id);
        changed = true;
      }
    };
    for (const id of [...visible]) {
      if (selected[id]) add(selected[id]);
      if (state.openParents.has(id))
        connections
          .filter(
            (link) =>
              isParent(link) &&
              link.target === id &&
              !state.hiddenPeople?.has(link.source),
          )
          .forEach((link) => add(link.source));
    }
    for (const group of allowedGroups)
      if (
        (group.parents.length === 1 ||
          !state.collapsedFamilies.has(group.id)) &&
        group.parents.some((id) => visible.has(id))
      )
        group.children.forEach((child) => {
          if (!state.hiddenPeople?.has(child.id)) add(child.id);
        });
  }
  return {
    visible,
    groups: allowedGroups.filter((group) =>
      group.parents.some((id) => visible.has(id)),
    ),
  };
}
export function toggleTreeParents(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
  id: string,
): TreeViewState {
  const parents = connections
    .filter((link) => isParent(link) && link.target === id)
    .map((link) => link.source);
  if (!parents.length) return state;
  const { visible, groups } = visibleTree(people, connections, state);
  const parentKey = [...new Set(parents)].sort().join('-');
  const open =
    parents.every((parent) => visible.has(parent)) &&
    !state.collapsedFamilies.has(parentKey) &&
    groups.some((group) => group.id === parentKey);
  let working = state;
  if (!open && parents.length === 2)
    working = selectPartner(people, connections, state, parents[0], parents[1]);
  const openParents = new Set(working.openParents);
  const hideSides = open ? [id] : [];
  for (const side of hideSides) {
    const ancestors = ancestorsOf(side, connections);
    openParents.delete(side);
    for (const expanded of [...openParents])
      if (
        ancestors.has(expanded) ||
        connections.some(
          (link) =>
            isParent(link) &&
            link.target === expanded &&
            ancestors.has(link.source),
        )
      )
        openParents.delete(expanded);
  }
  if (!open) {
    openParents.add(id);
    working = revealPeople(working, parents);
  }
  const collapsedFamilies = new Set(working.collapsedFamilies);
  if (!open) collapsedFamilies.delete(parentKey);
  return { ...working, anchorId: id, openParents, collapsedFamilies };
}
export function toggleTreeChildren(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
  familyId: string,
): TreeViewState {
  const group = familyGroups(people, connections).find(
    (group) => group.id === familyId,
  );
  if (!group) return state;
  const revealed = revealPeople(
    state,
    group.children.map((child) => child.id),
  );
  if (group.parents.length === 1) return revealed;
  const collapsedFamilies = new Set(state.collapsedFamilies);
  let anchorId = state.anchorId;
  if (collapsedFamilies.has(familyId)) collapsedFamilies.delete(familyId);
  else if (revealed === state) {
    collapsedFamilies.add(familyId);
    const descendants = new Set(group.children.map((child) => child.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const link of connections) {
        if (
          (isParent(link) && descendants.has(link.source)) ||
          (link.kind === 'partner' &&
            (descendants.has(link.source) || descendants.has(link.target)))
        ) {
          for (const id of link.kind === 'partner'
            ? [link.source, link.target]
            : [link.target])
            if (!descendants.has(id)) {
              descendants.add(id);
              changed = true;
            }
        }
      }
    }
    if (descendants.has(anchorId)) anchorId = group.parents[0];
  }
  return { ...revealed, anchorId, collapsedFamilies };
}

export function revealRelativeInTree(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
  request: RevealRelative,
): TreeViewState {
  let next = revealPeople(state, [request.id, request.relativeTo]);
  if (request.kind === 'partner')
    next = {
      ...selectPartner(
        people,
        connections,
        next,
        request.relativeTo,
        request.id,
      ),
      openParents: state.openParents,
    };
  const childId =
    request.kind === 'sibling'
      ? request.relativeTo
      : request.kind === 'child'
        ? request.id
        : null;
  if (childId) {
    const parents = familyBranches(people, connections).find(
      (branch) => branch.child === childId,
    )?.parents;
    if (parents?.length === 2)
      next = selectPartner(people, connections, next, parents[0], parents[1]);
  }
  if (request.kind === 'parent' || request.kind === 'sibling') {
    const parents = connections.filter(
      (link) => isParent(link) && link.target === request.relativeTo,
    );
    const { visible } = visibleTree(people, connections, next);
    if (parents.some((parent) => !visible.has(parent.source)))
      next = toggleTreeParents(people, connections, next, request.relativeTo);
    else
      next = {
        ...next,
        openParents: new Set([...next.openParents, request.relativeTo]),
      };
  }
  if (request.kind === 'partner') return next;
  const collapsedFamilies = new Set(next.collapsedFamilies);
  for (const group of familyGroups(people, connections))
    if (
      group.children.some(
        (child) =>
          child.id === request.id ||
          ((request.kind === 'parent' || request.kind === 'sibling') &&
            child.id === request.relativeTo),
      )
    )
      collapsedFamilies.delete(group.id);
  return { ...next, collapsedFamilies };
}
