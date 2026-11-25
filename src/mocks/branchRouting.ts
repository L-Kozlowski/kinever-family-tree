import type { DemoConnection, Person } from '../types';
import { familySubtreePositions } from './familyLayout.ts';
import {
  activePartners,
  familyGroups,
  partnerChoices,
  partnerViewPositions,
  visibleTree,
  type TreeViewState,
} from './familyView.ts';

type Point = { x: number; y: number };
type Group = ReturnType<typeof familyGroups>[number];

export function childRoute(
  group: Group,
  groups: Group[],
  visible: Set<string>,
  positionOf: (id: string) => Point,
  portraits: boolean,
  partners: Record<string, string | undefined>,
) {
  const parents = group.parents.filter((id) => visible.has(id));
  const points = parents.map(positionOf);
  let x = points.reduce((sum, point) => sum + point.x + 90, 0) / points.length;
  const parentBottom = Math.max(
    ...points.map((point) => point.y + (portraits ? 202 : 103)),
  );
  const children = group.children.filter((child) => visible.has(child.id));
  const childPoints = children.map((child) => positionOf(child.id));
  const childTop = childPoints.length
    ? Math.min(...childPoints.map((point) => point.y))
    : parentBottom + 138;
  const solo = group.parents.length === 1;
  const partner = solo ? partners[parents[0]] : undefined;
  const shared = partner
    ? groups.find(
        (other) =>
          other.parents.length === 2 &&
          other.parents.includes(parents[0]) &&
          other.parents.includes(partner),
      )
    : undefined;
  let soloLane = 0;
  if (partner && shared) {
    const left = positionOf(parents[0]).x <= positionOf(partner).x;
    const bounds = [
      positionOf(parents[0]).x + 90,
      positionOf(partner).x + 90,
      ...shared.children
        .filter((child) => visible.has(child.id))
        .map((child) => positionOf(child.id).x + 90),
    ];
    x = left ? Math.min(...bounds) - 120 : Math.max(...bounds) + 120;
    soloLane = left ? 28 : 42;
  }
  const busY = Math.max(parentBottom + 62, childTop - 60) + soloLane;
  const span = [x, ...childPoints.map((point) => point.x + 90)];
  return {
    x,
    parentBottom,
    children,
    solo,
    busY,
    soloLane,
    left: Math.min(...span),
    right: Math.max(...span),
  };
}

export function uncrowdedTree(
  people: Person[],
  connections: DemoConnection[],
  requested: TreeViewState,
  base: Record<string, Point>,
  portraits: boolean,
  preferredFamily?: string,
) {
  const calculate = (view: TreeViewState) => {
    const familyView = visibleTree(people, connections, view);
    const { visible, groups } = familyView;
    const partners = activePartners(people, connections, view);
    const display = partnerViewPositions(
      people,
      connections,
      view,
      visible,
      base,
    );
    const positions = familySubtreePositions(
      people,
      connections,
      view,
      visible,
      display,
    );
    const routes = groups
      .filter((group) => !view.collapsedFamilies.has(group.id))
      .map((group) => ({
        group,
        ...childRoute(
          group,
          groups,
          visible,
          (id) => positions[id],
          portraits,
          partners,
        ),
      }))
      .filter((route) => route.children.length);
    return { view, familyView, routes, positions };
  };
  let current = calculate(requested);
  type Route = (typeof current.routes)[number];
  const overlaps = (a: Route, b: Route) =>
    Math.abs(a.busY - b.busY) < 2 &&
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1;
  for (;;) {
    const conflicts = current.routes.flatMap((a, index) =>
      current.routes
        .slice(index + 1)
        .filter((b) => overlaps(a, b))
        .flatMap((b) => [a, b]),
    );
    const candidates = [...new Set(conflicts)]
      .filter(
        ({ group, solo }) =>
          !solo &&
          group.id !== preferredFamily &&
          !group.children.some((child) => child.id === requested.anchorId),
      )
      .sort(
        (a, b) =>
          b.right - b.left - (a.right - a.left) ||
          a.group.id.localeCompare(b.group.id),
      );
    let resolved = false;
    for (const { group } of candidates) {
      const next = calculate({
        ...current.view,
        collapsedFamilies: new Set([
          ...current.view.collapsedFamilies,
          group.id,
        ]),
      });
      if (
        preferredFamily &&
        current.routes.some((route) => route.group.id === preferredFamily) &&
        !next.routes.some((route) => route.group.id === preferredFamily)
      )
        continue;
      current = next;
      resolved = true;
      break;
    }
    if (!resolved) {
      // A single-parent branch cannot be collapsed with the couple control.
      const placed: Route[] = [];
      const ordered = [...current.routes].sort(
        (a, b) =>
          Number(b.group.id === preferredFamily) -
          Number(a.group.id === preferredFamily),
      );
      for (const route of ordered) {
        const adjusted = { ...route };
        while (placed.some((other) => overlaps(adjusted, other))) {
          adjusted.busY += 6;
        }
        placed.push(adjusted);
      }
      return {
        ...current,
        busByFamily: new Map(
          placed.map((route) => [route.group.id, route.busY]),
        ),
      };
    }
  }
}
