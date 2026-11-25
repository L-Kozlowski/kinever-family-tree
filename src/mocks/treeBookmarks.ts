import type { Person } from '../types';
import type { TreeViewState } from './familyView.ts';

export type SavedTreeView = Omit<
  TreeViewState,
  'openParents' | 'collapsedFamilies' | 'hiddenPeople'
> & {
  openParents: string[];
  collapsedFamilies: string[];
  hiddenPeople?: string[];
};

export type TreeBookmark = {
  id: string;
  name: string;
  color?: string;
  view: SavedTreeView;
  knownPersonIds: string[];
  positions: Record<string, { x: number; y: number }>;
  viewport: { x: number; y: number; zoom: number };
  manual: boolean;
  portraits: boolean;
};

export function saveTreeView(view: TreeViewState): SavedTreeView {
  return {
    ...view,
    openParents: [...view.openParents],
    collapsedFamilies: [...view.collapsedFamilies],
    hiddenPeople: view.hiddenPeople && [...view.hiddenPeople],
  };
}

export function loadTreeView(saved: SavedTreeView): TreeViewState {
  return {
    ...saved,
    openParents: new Set(saved.openParents),
    collapsedFamilies: new Set(saved.collapsedFamilies),
    hiddenPeople: saved.hiddenPeople && new Set(saved.hiddenPeople),
  };
}

export function restoreBookmarkView(
  view: SavedTreeView,
  knownPersonIds: string[],
  people: Person[],
): TreeViewState {
  const restored = loadTreeView(view);
  const known = new Set(knownPersonIds);
  const hiddenPeople = new Set(restored.hiddenPeople);
  for (const person of people)
    if (!known.has(person.id)) hiddenPeople.add(person.id);
  return { ...restored, hiddenPeople };
}
