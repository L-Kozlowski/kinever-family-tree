import type { DemoConnection, Person } from '../types';
import {
  activePartners,
  comparePartnerSides,
  familyGroups,
  partnerChoices,
  type TreeViewState,
} from './familyView.ts';

type Point = { x: number; y: number };
/** Reserve complete descendant subtrees before placing their parents. */
export function familySubtreePositions(
  people: Person[],
  connections: DemoConnection[],
  state: TreeViewState,
  visible: Set<string>,
  base: Record<string, Point>,
) {
  const selected = activePartners(people, connections, state);
  const groups = familyGroups(people, connections).filter((group) => {
    if (!group.parents.every((id) => visible.has(id))) return false;
    const [a, b] = group.parents;
    return (
      !b ||
      !partnerChoices(people, connections, a).includes(b) ||
      selected[a] === b
    );
  });
  const blocks: {
    id: string;
    members: string[];
    children: { block: string; person: string; group: string }[];
    preferred: string[];
  }[] = [];
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const owner = new Map<string, string>();
  for (const person of people) {
    if (!visible.has(person.id) || owner.has(person.id)) continue;
    const partner =
      selected[person.id] ||
      groups
        .find((g) => g.parents.length === 2 && g.parents.includes(person.id))
        ?.parents.find((id) => id !== person.id);
    const members =
      partner && visible.has(partner) && !owner.has(partner)
        ? [person.id, partner]
        : [person.id];
    members.sort(
      (a, b) =>
        comparePartnerSides(peopleById.get(a), peopleById.get(b)) ||
        (base[a]?.x || 0) - (base[b]?.x || 0),
    );
    const block = {
      id: person.id,
      members,
      children: [] as { block: string; person: string; group: string }[],
      preferred: [] as string[],
    };
    members.forEach((id) => owner.set(id, block.id));
    blocks.push(block);
  }
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const parentOf = new Map<string, string>();
  const branches = groups.flatMap((group) =>
    (group.parents.length > 1 && state.collapsedFamilies.has(group.id)
      ? []
      : group.children
    ).map((child) => ({ group, child })),
  );
  const childSide = (id: string) =>
    byId.get(owner.get(id) || '')?.members.indexOf(id) ?? 0;
  branches.sort(
    (a, b) =>
      childSide(a.child.id) - childSide(b.child.id) ||
      b.group.parents.length - a.group.parents.length,
  );
  for (const { group, child } of branches) {
    const parent = byId.get(owner.get(group.parents[0]) || '');
    if (!parent) continue;
    const block = owner.get(child.id);
    if (!block || block === parent.id) continue;
    if (parentOf.has(block)) {
      if (
        parentOf.get(block) === parent.id &&
        group.parents.length === parent.members.length
      )
        parent.preferred.push(child.id);
      continue;
    }
    // Avoid household cycles even when an unusual partnership crosses generations.
    let ancestor: string | undefined = parent.id;
    const visited = new Set<string>();
    while (ancestor && !visited.has(ancestor) && ancestor !== block) {
      visited.add(ancestor);
      ancestor = parentOf.get(ancestor);
    }
    if (ancestor === block) continue;
    parentOf.set(block, parent.id);
    parent.children.push({ block, person: child.id, group: group.id });
    if (group.parents.length === parent.members.length)
      parent.preferred.push(child.id);
  }
  // Put a household receiving a second ancestral line at the boundary
  // of the first branch, so that line does not cross sibling connectors.
  const joinsOtherBranch = new Set<string>();
  for (const { group, child } of branches) {
    const household = owner.get(child.id);
    const parent = owner.get(group.parents[0]);
    if (
      household &&
      parent &&
      parentOf.has(household) &&
      parentOf.get(household) !== parent &&
      childSide(child.id) === 1
    ) {
      joinsOtherBranch.add(household);
    }
  }
  const measured = new Map<
    string,
    { width: number; left: number; children: { id: string; x: number }[] }
  >();
  const measure = (
    id: string,
  ): { width: number; left: number; children: { id: string; x: number }[] } => {
    const cached = measured.get(id);
    if (cached) return cached;
    const block = byId.get(id)!;
    const ownWidth = 180 + (block.members.length - 1) * 240;
    block.children.sort(
      (a, b) =>
        Number(joinsOtherBranch.has(a.block)) -
          Number(joinsOtherBranch.has(b.block)) ||
        (base[a.person]?.x || 0) - (base[b.person]?.x || 0),
    );
    let cursor = 0;
    const childAnchors: { id: string; x: number }[] = [];
    const children = block.children.map((child) => {
      const subtree = measure(child.block);
      const x = cursor;
      const childBlock = byId.get(child.block)!;
      const actualChildren = new Set(
        groups
          .filter((group) =>
            group.parents.every((parent) => block.members.includes(parent)),
          )
          .flatMap((group) => group.children.map((person) => person.id))
          .filter((person) => owner.get(person) === child.block),
      );
      for (const person of actualChildren)
        childAnchors.push({
          id: person,
          x: x + subtree.left + childBlock.members.indexOf(person) * 240 + 90,
        });
      cursor += subtree.width + 160;
      return { id: child.block, x };
    });
    const preferred = childAnchors.filter((child) =>
      block.preferred.includes(child.id),
    );
    const anchors = preferred.length ? preferred : childAnchors;
    const centre = anchors.length
      ? (Math.min(...anchors.map((a) => a.x)) +
          Math.max(...anchors.map((a) => a.x))) /
        2
      : ownWidth / 2;
    const shift = Math.max(0, ownWidth / 2 - centre);
    const left = centre + shift - ownWidth / 2;
    children.forEach((child) => (child.x += shift));
    const result = {
      width: Math.max(
        ownWidth + left,
        children.length ? cursor - 160 + shift : ownWidth,
      ),
      left,
      children,
    };
    measured.set(id, result);
    return result;
  };
  // Include both parental branches when assigning generations. The packing
  // tree has only one owner per household, but the other side still needs
  // to end immediately above that household when its branch is shorter.
  const descendants = new Map(
    blocks.map((block) => [
      block.id,
      new Set(block.children.map((child) => child.block)),
    ]),
  );
  const reaches = (start: string, target: string) => {
    const stack = [start];
    const visited = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (id === target) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      stack.push(...descendants.get(id)!);
    }
    return false;
  };
  for (const { group, child } of branches) {
    const parent = owner.get(group.parents[0]);
    const target = owner.get(child.id);
    if (
      parent &&
      target &&
      !descendants.get(parent)!.has(target) &&
      !reaches(target, parent)
    )
      descendants.get(parent)!.add(target);
  }
  const incoming = new Map(blocks.map((block) => [block.id, 0]));
  const depths = new Map(incoming);
  for (const children of descendants.values())
    for (const child of children) incoming.set(child, incoming.get(child)! + 1);
  const order = [...incoming]
    .filter(([, count]) => count === 0)
    .map(([id]) => id);
  for (const id of order) {
    for (const child of descendants.get(id)!) {
      depths.set(child, Math.max(depths.get(child)!, depths.get(id)! + 1));
      incoming.set(child, incoming.get(child)! - 1);
      if (incoming.get(child) === 0) order.push(child);
    }
  }
  // A partner's ancestors can make one sibling's minimum depth larger.
  // Level the whole sibling group, then propagate the change to descendants.
  const siblings = new Map<string, Set<string>>();
  for (const children of descendants.values()) {
    if (children.size < 2) continue;
    const peers = new Set(
      [...children].flatMap((id) => [...(siblings.get(id) ?? [id])]),
    );
    for (const id of peers) siblings.set(id, peers);
  }
  const originalDepths = new Map(depths);
  let settled = false;
  for (let pass = 0; pass <= blocks.length; pass++) {
    let changed = false;
    for (const id of order) {
      const peers = siblings.get(id) ?? [id];
      const depth = Math.max(...[...peers].map((peer) => depths.get(peer)!));
      if (depth > depths.get(id)!) {
        depths.set(id, depth);
        changed = true;
      }
      for (const child of descendants.get(id)!) {
        if (depths.get(child)! > depth) continue;
        depths.set(child, depth + 1);
        changed = true;
      }
    }
    if (!changed) {
      settled = true;
      break;
    }
  }
  // Partnerships spanning generations may make equal levels impossible.
  if (!settled) for (const [id, depth] of originalDepths) depths.set(id, depth);
  for (const id of order.reverse()) {
    const peers = settled ? (siblings.get(id) ?? [id]) : [id];
    const children = [...peers].flatMap((peer) => [...descendants.get(peer)!]);
    if (!children.length) continue;
    const depth = Math.min(...children.map((child) => depths.get(child)!)) - 1;
    for (const peer of peers) depths.set(peer, depth);
  }
  const result = Object.fromEntries(
    Object.entries(base).map(([id, p]) => [id, { ...p }]),
  );
  const top = Math.min(40, ...[...visible].map((id) => base[id]?.y ?? 40));
  const place = (id: string, x: number) => {
    const block = byId.get(id)!;
    const layout = measure(id);
    block.members.forEach((member, index) => {
      result[member] = {
        x: x + layout.left + index * 240,
        y: top + depths.get(id)! * 340,
      };
    });
    layout.children.forEach((child) => place(child.id, x + child.x));
  };
  const rootOf = (id: string) => {
    let root = id;
    while (parentOf.has(root)) root = parentOf.get(root)!;
    return root;
  };
  // Two ancestral lines that meet at a couple are placed in the same
  // left-to-right order as the couple's cards.
  const ancestralRoots = (person: string) =>
    new Set(
      branches
        .filter(({ child }) => child.id === person)
        .map(({ group }) => owner.get(group.parents[0]))
        .filter((id): id is string => !!id)
        .map(rootOf),
    );
  const roots = blocks
    .filter((block) => !parentOf.has(block.id))
    .sort(
      (a, b) => (base[a.members[0]]?.x ?? 0) - (base[b.members[0]]?.x ?? 0),
    );
  const before = new Map(roots.map((root) => [root.id, new Set<string>()]));
  for (const block of blocks) {
    if (block.members.length !== 2) continue;
    const [left, right] = block.members.map(ancestralRoots);
    for (const r of right)
      for (const l of left)
        if (l !== r && !right.has(l) && !left.has(r)) before.get(r)?.add(l);
  }
  const remaining = [...roots];
  const occupied = new Map<number, number>();
  const placed = new Set<string>();
  while (remaining.length) {
    const next = remaining.findIndex(
      (root) => !remaining.some((other) => before.get(root.id)?.has(other.id)),
    );
    const [block] = remaining.splice(Math.max(0, next), 1);
    place(block.id, 0);
    const members = blocks
      .filter((item) => rootOf(item.id) === block.id)
      .flatMap((item) => item.members);
    const bounds = new Map<number, { left: number; right: number }>();
    const reserve = (row: number, left: number, right: number) => {
      const old = bounds.get(row);
      bounds.set(row, {
        left: Math.min(old?.left ?? left, left),
        right: Math.max(old?.right ?? right, right),
      });
    };
    for (const id of members) {
      const { x, y } = result[id];
      reserve(y, x, x + 180);
    }
    const joins: { row: number; source: number; target: number }[] = [];
    for (const { group, child } of branches) {
      const parent = owner.get(group.parents[0]);
      const target = owner.get(child.id);
      if (!parent || !target || rootOf(parent) !== block.id) continue;
      const points = group.parents.map((id) => result[id]);
      const source =
        points.reduce((sum, point) => sum + point.x + 90, 0) / points.length;
      const row = Math.max(...points.map((point) => point.y)) + 1;
      const childX = result[child.id].x + 90;
      if (rootOf(target) === block.id)
        reserve(row, Math.min(source, childX), Math.max(source, childX));
      else if (placed.has(rootOf(target)))
        joins.push({ row, source, target: childX });
    }
    let minimum = -Infinity;
    for (const [row, span] of bounds)
      if (occupied.has(row))
        minimum = Math.max(minimum, occupied.get(row)! + 120 - span.left);
    for (const join of joins)
      if (occupied.has(join.row) && join.target > occupied.get(join.row)!)
        minimum = Math.max(minimum, occupied.get(join.row)! + 30 - join.source);
    const desired = joins.length
      ? joins.reduce((sum, join) => sum + join.target - join.source, 0) /
        joins.length
      : minimum;
    const offset = Math.max(minimum, Number.isFinite(desired) ? desired : 0);
    for (const id of members) result[id].x += offset;
    for (const [row, span] of bounds)
      occupied.set(
        row,
        Math.max(occupied.get(row) ?? -Infinity, span.right + offset),
      );
    for (const join of joins)
      occupied.set(
        join.row,
        Math.max(
          occupied.get(join.row) ?? -Infinity,
          join.source + offset,
          join.target,
        ),
      );
    placed.add(block.id);
  }
  // Keep the active household in place when an ancestral branch is added.
  const anchor = state.anchorId;
  if (base[anchor] && result[anchor] && visible.has(anchor)) {
    const offset = base[anchor].x - result[anchor].x;
    for (const id of visible) if (result[id]) result[id].x += offset;
  }
  return result;
}
