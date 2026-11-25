import type { DemoConnection, Person } from '../types';

/** One directly related representative for each branch disconnected by deletion. */
export function deletionImpact(
  people: Person[],
  links: DemoConnection[],
  id: string,
): string[] {
  const graph = new Map(people.map((person) => [person.id, new Set<string>()]));
  for (const link of links) {
    graph.get(link.source)?.add(link.target);
    graph.get(link.target)?.add(link.source);
  }
  const reached = new Set<string>();
  const nearest: string[] = [];
  let isolated = false;
  for (const neighbor of graph.get(id) || []) {
    if (reached.has(neighbor)) continue;
    nearest.push(neighbor);
    const queue = [neighbor];
    let size = 0;
    while (queue.length) {
      const current = queue.pop()!;
      if (current === id || reached.has(current)) continue;
      reached.add(current);
      size++;
      for (const next of graph.get(current) || [])
        if (next !== id) queue.push(next);
    }
    if (size === 1) isolated = true;
  }
  return nearest.length > 1 || isolated ? nearest : [];
}
